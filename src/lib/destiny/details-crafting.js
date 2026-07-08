import { cleanText, mapWithConcurrency } from '../utils/index.js';
import { positiveNumber } from '../http/index.js';
import { bungieFetch, numberStat, percentStat } from '../bungie/index.js';
import {
  getWorkerCachedJson,
  activityDefinitionConcurrency
} from '../cache/index.js';
import { readLatestGearPointer } from '../gear/cache.js';
import { GEAR_SPLIT_PREFIX, craftablesPath, joinGearPath, searchShardPath } from '../gear/split-paths.js';
import { CACHE_VERSION } from '../shared/index.js';
import { itemDefinitionCache } from './state.js';
import { hasFailures } from './privacy.js';

export async function summarizeCrafting(characterCraftables, env, ctx, profileRecords = {}) {
  const aggregate = new Map();
  for (const [characterId, component] of Object.entries(characterCraftables || {})) {
    for (const [hash, craftable] of Object.entries(component?.craftables || {})) {
      const item = aggregate.get(hash) || {
        hash,
        visible: false,
        unlocked: false,
        failedRequirementCount: 0,
        socketCount: 0,
        plugCount: 0,
        unlockedPlugCount: 0,
        characterIds: new Set()
      };
      const visible = Boolean(craftable.visible);
      const recipeUnlocked = visible && !hasFailures(craftable.failedRequirementIndexes);
      const sockets = Array.isArray(craftable.sockets) ? craftable.sockets : [];
      let plugCount = 0;
      let unlockedPlugCount = 0;
      for (const socket of sockets) {
        for (const plug of socket.plugs || []) {
          plugCount += 1;
          if (!hasFailures(plug.failedRequirementIndexes)) unlockedPlugCount += 1;
        }
      }

      item.visible = item.visible || visible;
      item.unlocked = item.unlocked || recipeUnlocked;
      item.failedRequirementCount = Math.max(item.failedRequirementCount, Array.isArray(craftable.failedRequirementIndexes) ? craftable.failedRequirementIndexes.length : 0);
      item.socketCount = Math.max(item.socketCount, sockets.length);
      item.plugCount = Math.max(item.plugCount, plugCount);
      item.unlockedPlugCount = Math.max(item.unlockedPlugCount, unlockedPlugCount);
      item.characterIds.add(characterId);
      aggregate.set(hash, item);
    }
  }

  const entries = Array.from(aggregate.values()).filter((item) => item.visible);
  const enriched = await enrichCraftableItems(entries, env, ctx, profileRecords);
  const unlocked = entries.filter((item) => item.unlocked).length;
  const plugCount = entries.reduce((sum, item) => sum + item.plugCount, 0);
  const unlockedPlugCount = entries.reduce((sum, item) => sum + item.unlockedPlugCount, 0);

  return {
    total: numberStat(entries.length),
    unlocked: numberStat(unlocked),
    locked: numberStat(Math.max(0, entries.length - unlocked)),
    completionRate: percentStat(numberStat(unlocked), numberStat(entries.length)),
    plugTotal: numberStat(plugCount),
    plugUnlocked: numberStat(unlockedPlugCount),
    plugCompletionRate: percentStat(numberStat(unlockedPlugCount), numberStat(plugCount)),
    items: enriched
  };
}

export async function enrichCraftableItems(items, env, ctx, profileRecords = {}) {
  const selected = items
    .sort((a, b) => Number(a.unlocked) - Number(b.unlocked) || b.unlockedPlugCount - a.unlockedPlugCount || Number(a.hash) - Number(b.hash))
    .slice(0, 260);
  const definitions = await getInventoryItemDefinitions(selected.map((item) => item.hash), env, ctx);
  return selected.map((item) => {
    const definition = definitions.get(String(item.hash)) || {};
    const craftingInfo = definition.craftingInfo || {};
    const pattern = craftingPatternProgress(craftingInfo, profileRecords, item.unlocked);
    return {
      hash: item.hash,
      name: cleanText(definition.displayProperties?.name) || `装备 ${item.hash}`,
      type: definition.itemTypeDisplayName || '',
      icon: inventoryItemIcon(definition),
      tier: definition.inventory?.tierTypeName || '',
      source: cleanText(craftingInfo.source) || '其他来源',
      sourceHash: craftingInfo.sourceHash || 0,
      patternRecordHash: craftingInfo.patternRecordHash || 0,
      patternObjectiveHash: craftingInfo.patternObjectiveHash || 0,
      pattern,
      visible: Boolean(item.visible),
      unlocked: Boolean(item.unlocked),
      failedRequirementCount: numberStat(item.failedRequirementCount),
      socketCount: numberStat(item.socketCount),
      plugCount: numberStat(item.plugCount),
      unlockedPlugCount: numberStat(item.unlockedPlugCount),
      plugCompletionRate: percentStat(numberStat(item.unlockedPlugCount), numberStat(item.plugCount)),
      characterCount: numberStat(item.characterIds.size)
    };
  });
}

export async function getInventoryItemDefinitions(hashes, env, ctx) {
  const uniqueHashes = Array.from(new Set(hashes.filter(Boolean).map(String)));
  const staticItems = await loadStaticGearItems(env, ctx);
  const byHash = new Map(staticItems.map((item) => [String(item.hash), item]));
  const entries = uniqueHashes.map((hash) => {
    if (itemDefinitionCache.has(hash)) return [hash, itemDefinitionCache.get(hash)];
    const item = byHash.get(hash);
    const definition = item
      ? {
          displayProperties: {
            name: item.name,
            icon: item.icon || ''
          },
          itemTypeDisplayName: item.weaponType || item.type || '',
          inventory: {
            tierTypeName: item.tier || ''
          },
          craftingInfo: {
            source: item.source || '',
            sourceHash: item.sourceHash || 0,
            patternRecordHash: item.patternRecordHash || 0,
            patternObjectiveHash: item.patternObjectiveHash || 0,
            outputItemHash: item.outputItemHash || 0,
            outputCollectibleHash: item.outputCollectibleHash || 0,
            watermark: item.watermark || ''
          }
        }
      : {};
    itemDefinitionCache.set(hash, definition);
    return [hash, definition];
  });

  const missing = entries
    .filter(([, definition]) => !definition.displayProperties?.name)
    .slice(0, 18)
    .map(([hash]) => hash);
  const fetched = await mapWithConcurrency(missing, activityDefinitionConcurrency(env), async (hash) => {
    try {
      const payload = await bungieFetch(
        `/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/?lc=${encodeURIComponent(env.BUNGIE_LOCALE || 'zh-chs')}`,
        { method: 'GET' },
        env
      );
      const definition = payload.Response || {};
      itemDefinitionCache.set(hash, definition);
      return [hash, definition];
    } catch {
      return [hash, itemDefinitionCache.get(hash) || {}];
    }
  });

  return new Map(
    entries.map(([hash, definition]) => {
      const fallback = fetched.find(([itemHash]) => itemHash === hash);
      return fallback || [hash, definition];
    })
  );
}

export async function loadStaticGearItems(env, ctx) {
  const locale = env.BUNGIE_LOCALE || 'zh-chs';
  const cacheKey = ['static-gear-items-v3', CACHE_VERSION, locale].join(':');
  const cached = await getWorkerCachedJson(
    cacheKey,
    positiveNumber(env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800),
    async () => {
      const r2Items = await loadR2GearItems(env);
      if (r2Items.length) return r2Items;
      if (!env.ASSETS?.fetch) return [];
      const response = await env.ASSETS.fetch(new Request(`https://assets.local/data/gear-index-${locale}.json`));
      if (!response.ok) return [];
      const index = await response.json();
      return [
        ...(index.items || []).filter((item) => item.kind === 'weapon'),
        ...(index.craftables || [])
      ];
    },
    env,
    ctx,
    { memoryOnly: true }
  );
  return cached.value || [];
}

async function loadR2GearItems(env) {
  if (!env.CAREER_R2?.get) return [];
  try {
    const pointer = await readLatestGearPointer(env);
    if (!pointer?.root) return [];
    const root = gearRootPath(pointer, env);
    const [weaponObject, craftableObject] = await Promise.all([
      env.CAREER_R2.get(joinGearPath(root, searchShardPath('weapon'))),
      env.CAREER_R2.get(joinGearPath(root, craftablesPath()))
    ]);
    const [weaponShard, craftableShard] = await Promise.all([
      weaponObject ? weaponObject.json() : Promise.resolve(null),
      craftableObject ? craftableObject.json() : Promise.resolve(null)
    ]);
    return [
      ...itemsFromShard(weaponShard, 'weapon'),
      ...itemsFromShard(craftableShard, 'craftable')
    ];
  } catch {
    return [];
  }
}

function itemsFromShard(shard, kind) {
  return Array.isArray(shard?.items) ? shard.items.filter((item) => item.kind === kind) : [];
}

function gearRootPath(pointer, env) {
  const root = String(pointer?.root || '');
  if (!root) return '';
  if (root.includes('/')) return root;
  return joinGearPath(env.R2_GEAR_PREFIX || GEAR_SPLIT_PREFIX, env.BUNGIE_LOCALE || 'zh-chs', root);
}

export function inventoryItemIcon(definition) {
  const icon = definition.displayProperties?.icon || '';
  if (!icon) return '';
  return icon.startsWith('http') ? icon : `https://www.bungie.net${icon}`;
}

export function craftingPatternProgress(craftingInfo, profileRecords, unlocked) {
  const recordHash = craftingInfo.patternRecordHash ? String(craftingInfo.patternRecordHash) : '';
  const objectiveHash = craftingInfo.patternObjectiveHash ? String(craftingInfo.patternObjectiveHash) : '';
  const record = recordHash ? profileRecords?.[recordHash] : null;
  const objective = (record?.objectives || []).find((entry) => String(entry.objectiveHash) === objectiveHash) || record?.objectives?.[0] || null;
  if (!objective) {
    const fallback = unlocked ? 1 : 0;
    return {
      current: numberStat(fallback),
      required: numberStat(unlocked ? 1 : 0),
      complete: Boolean(unlocked),
      label: unlocked ? '1/1' : '-',
      percent: unlocked ? 100 : 0
    };
  }

  const required = Math.max(0, Number(objective.completionValue || 0));
  const current = Math.max(0, Math.min(required || Number(objective.progress || 0), Number(objective.progress || 0)));
  const complete = Boolean(objective.complete) || (required > 0 && current >= required);
  return {
    current: numberStat(current),
    required: numberStat(required),
    complete,
    label: required > 0 ? `${current}/${required}` : '-',
    percent: required > 0 ? Math.max(0, Math.min(100, (current / required) * 100)) : 0
  };
}
