import { normalizeGearKind, sourceSearchText } from './labels.js';
import { cleanText, clampNumber, httpError, requireApiKey, normalizeText } from './utils.js';
import { getGearItemIndex, getGearSearchIndex } from './index-cache.js';
import {
  compareGearItems,
  armorSetBonusHashSet,
  enrichGearSearchItem
} from './search.js';
import { publicGearItem, publicGearDetail } from './public.js';
import { GEAR_INDEX_VERSION } from './constants.js';
import {
  tryEncounterSearch,
  trySourceAliasSearch,
  loadSourceAliases,
  enrichGearIndexSources,
  enrichGearItemSources
} from './handlers-source.js';
import { buildPerkWeapons, withPerkWeaponsCacheMeta } from './handlers-perk-weapons.js';

const PERK_WEAPONS_DEFAULT_LIMIT = 24;
const PERK_WEAPONS_MAX_LIMIT = 60;
const PERK_WEAPONS_CACHE_TTL_SECONDS = 604800;

export async function getGearSearch(body, deps) {
  requireApiKey(deps);
  const query = cleanText(body?.query || body?.name || '');
  if (!query) {
    throw httpError(400, 'INVALID_GEAR_QUERY', '请输入武器、护甲或 perk 名称');
  }

  const kind = normalizeGearKind(body?.kind || body?.type || 'all');
  const limit = clampNumber(body?.limit, 1, 120, 60);
  const aliases = await loadSourceAliases(deps);

  const encounterResult = await tryEncounterSearch(query, deps);
  if (encounterResult) {
    return {
      updatedAt: new Date().toISOString(),
      manifestVersion: encounterResult.manifestVersion || null,
      query,
      kind,
      total: encounterResult.total,
      items: encounterResult.items.map((item) => publicGearItem(enrichGearItemSources(item, aliases))),
      encounter: {
        sourceText: encounterResult.sourceText,
        encounterZh: encounterResult.encounterZh,
        encounterKey: encounterResult.encounterKey
      },
      cache: { gearIndex: 'encounter-source' }
    };
  }

  const sourceResult = await trySourceAliasSearch(query, deps, kind, limit);
  if (sourceResult) {
    return {
      updatedAt: new Date().toISOString(),
      manifestVersion: sourceResult.manifestVersion || null,
      query,
      kind,
      total: sourceResult.total,
      items: sourceResult.items.map((item) => publicGearItem(enrichGearItemSources(item, aliases))),
      source: {
        sourceText: sourceResult.sourceText,
        sourceZh: sourceResult.sourceZh,
        sourceType: sourceResult.sourceType
      },
      cache: {
        gearIndex: 'source-alias',
        sourceIndex: sourceResult.cacheStatus || 'miss-memory'
      }
    };
  }

  const cached = await getGearSearchIndex(deps, kind);
  const index = cached.value;
  const terms = normalizeText(query);
  const armorSetBonusHashes = armorSetBonusHashSet(index);

  const candidates = index.items.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false;
    return item.searchText.includes(terms) || sourceSearchText(item).includes(terms) || String(item.hash) === query;
  });

  const items = candidates
    .sort((a, b) => compareGearItems(a, b, terms, query, armorSetBonusHashes))
    .slice(0, limit)
    .map((item) => publicGearItem(enrichGearItemSources(enrichGearSearchItem(item, index, armorSetBonusHashes), aliases)));

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: index.manifestVersion,
    query,
    kind,
    total: candidates.length,
    items,
    cache: {
      gearIndex: cached.status,
      gearIndexCachedAt: cached.cachedAt,
      gearIndexTtlSeconds: cached.ttlSeconds
    }
  };
}

export async function getGearItem(body, deps) {
  requireApiKey(deps);
  const hash = cleanText(body?.hash || '');
  if (!hash) {
    throw httpError(400, 'INVALID_GEAR_HASH', '请输入装备 hash');
  }

  const cached = await getGearItemIndex(deps, hash);
  const index = cached.value;
  const item = index.items.find((entry) => String(entry.hash) === hash);
  if (!item) {
    throw httpError(404, 'GEAR_ITEM_NOT_FOUND', '没有找到这个装备');
  }
  const aliases = await loadSourceAliases(deps);
  const enrichedIndex = enrichGearIndexSources(index, aliases);
  const enrichedItem = enrichGearItemSources(item, aliases);

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: index.manifestVersion,
    item: publicGearItem(enrichedItem),
    detail: publicGearDetail(enrichedItem, enrichedIndex),
    cache: {
      gearIndex: cached.status,
      gearIndexCachedAt: cached.cachedAt,
      gearIndexTtlSeconds: cached.ttlSeconds
    }
  };
}

export async function getPerkWeapons(body, deps) {
  requireApiKey(deps);
  const query = cleanText(body?.query || body?.name || '');
  const hash = cleanText(body?.hash || '');
  if (!query && !hash) {
    throw httpError(400, 'INVALID_PERK_QUERY', '请输入 perk 名称或 hash');
  }

  const limit = clampNumber(body?.limit, 1, PERK_WEAPONS_MAX_LIMIT, PERK_WEAPONS_DEFAULT_LIMIT);
  const offset = clampNumber(body?.offset, 0, Number.MAX_SAFE_INTEGER, 0);
  const ttlSeconds = deps.cacheTtlSeconds || PERK_WEAPONS_CACHE_TTL_SECONDS;
  const cacheKey = ['perk-weapons', GEAR_INDEX_VERSION, deps.locale || 'zh-chs', query || hash, limit, offset].join(':');

  if (typeof deps.getCachedJson === 'function') {
    const cached = await deps.getCachedJson(cacheKey, ttlSeconds, () => buildPerkWeapons(deps, query, hash, limit, offset));
    return withPerkWeaponsCacheMeta(cached.value, cached);
  }

  const value = await buildPerkWeapons(deps, query, hash, limit, offset);
  return withPerkWeaponsCacheMeta(value, {
    status: 'miss-memory',
    cachedAt: new Date().toISOString(),
    ttlSeconds
  });
}
