import { EMPTY_TRAIT_SOCKET } from './constants.js';
import { cleanText, normalizeText, uniqueNumbers } from './utils.js';
import {
  displayName,
  displayDescription,
  iconUrl,
  imageUrl,
  isEnhancedPerk,
  baseWeaponName
} from './labels.js';

export function makeWeaponRecord(definition, item, items, plugSets, statDefs, weaponPlugs, craftingInfoByHash = new Map(), sandboxPerks = {}, objectiveDefs = {}) {
  const sockets = [];
  const entries = definition.sockets?.socketEntries || [];
  const craftingInfo = craftingInfoByHash.get(Number(definition.hash));
  for (let index = 0; index < entries.length; index += 1) {
    const hashes = plugHashesForSocket(entries[index], plugSets);
    const perks = hashes
      .map((hash) => items[String(hash)])
      .filter(Boolean)
      .filter(isWeaponSocketPlug)
      .map((plug) => {
        addWeaponPlug(weaponPlugs, plug, statDefs);
        return Number(plug.hash);
      });

    if (perks.length) {
      sockets.push({
        socketIndex: index,
        label: weaponSocketLabel(index, perks, items),
        perks: uniqueNumbers(perks)
      });
    }
  }

  return {
    hash: item.hash,
    name: item.name,
    baseName: baseWeaponName(item.name),
    icon: item.icon,
    weaponType: item.weaponType,
    ammo: item.ammo,
    element: item.element,
    adept: item.adept,
    stats: formatStats(definition, statDefs),
    screenshot: imageUrl(definition.screenshot),
    sockets,
    sourceHints: item.sourceHints || [],
    crafting: craftingInfo || null,
    catalyst: makeCatalystRecord(definition, items, plugSets, sandboxPerks, statDefs, objectiveDefs)
  };
}

export function makeCatalystRecord(definition, items, plugSets, sandboxPerks, statDefs, objectiveDefs) {
  if (definition.inventory?.tierType !== 6) return null;
  const candidates = [];
  for (const entry of definition.sockets?.socketEntries || []) {
    for (const hash of plugHashesForSocket(entry, plugSets)) {
      const plug = items[String(hash)];
      if (!isCatalystPlug(plug)) continue;
      const perkEntry = (plug.perks || []).find((perk) => perk.perkHash);
      const perkDef = perkEntry ? sandboxPerks[String(perkEntry.perkHash)] : null;
      const perkName = displayName(perkDef || plug);
      const perkDescription = cleanText(displayDescription(perkDef || plug));
      if (!perkName && !perkDescription) continue;

      const statBonuses = (plug.investmentStats || [])
        .filter((stat) => Number(stat.value || 0) !== 0)
        .map((stat) => {
          const statDef = statDefs[String(stat.statTypeHash)];
          const name = statDef ? displayName(statDef) : '';
          return name ? { name, value: Number(stat.value || 0) } : null;
        })
        .filter(Boolean);
      const objHash = plug.objectives?.objectiveHashes?.[0];
      const objDef = objHash ? objectiveDefs[String(objHash)] : null;
      const killsRequired = Number(objDef?.completionValue || 0);

      candidates.push({
        perk: {
          name: perkName,
          description: perkDescription,
          icon: iconUrl(perkDef || plug)
        },
        statBonuses,
        killsRequired,
        progressDescription: cleanText(objDef?.progressDescription || ''),
        score: catalystCandidateScore(plug, perkDef, statBonuses, killsRequired)
      });
    }
  }
  const [best] = candidates.sort((a, b) => b.score - a.score);
  if (!best) return null;
  const { score: _score, ...record } = best;
  return record;
}

function isCatalystPlug(plug) {
  if (!plug || plug.redacted) return false;
  const name = displayName(plug);
  const description = cleanText(displayDescription(plug));
  const category = String(plug.plug?.plugCategoryIdentifier || '').toLowerCase();
  const text = `${name} ${description} ${category}`.toLowerCase();
  if (!category.includes('masterwork') && !category.includes('catalyst') && !text.includes('催化')) return false;
  if (/tracker|kill_counter/.test(category)) return false;
  if (name.includes('击杀记录器') || name.includes('空催化插槽')) return false;
  if (description.includes('可以将异域催化插入此插槽')) return false;
  return true;
}

function catalystCandidateScore(plug, perkDef, statBonuses, killsRequired) {
  const name = displayName(plug);
  const category = String(plug.plug?.plugCategoryIdentifier || '').toLowerCase();
  return [
    perkDef ? 100 : 0,
    killsRequired > 1 ? 50 : 0,
    statBonuses.length ? 25 : 0,
    name.includes('催化') ? 10 : 0,
    category.includes('catalyst') ? 5 : 0
  ].reduce((sum, value) => sum + value, 0);
}

export function makeArmorRecord(definition, item, items, itemSetByItemHash, statDefs) {
  return {
    hash: item.hash,
    name: item.name,
    icon: item.icon,
    type: item.type,
    slot: item.slot,
    className: item.className,
    tier: item.tier,
    stats: formatStats(definition, statDefs),
    setBonus: itemSetByItemHash.get(item.hash) || null,
    intrinsicPerks: armorIntrinsicPerks(definition, items),
    sourceHints: item.sourceHints || []
  };
}

export function resolveSocketPerks(socket, perkByHash) {
  return (socket.perks || [])
    .map((entry) => {
      if (typeof entry === 'number') return perkByHash.get(entry);
      if (entry?.hash) return perkByHash.get(entry.hash) || entry;
      return null;
    })
    .filter(Boolean);
}

export function addWeaponPlug(output, definition, statDefs) {
  const hash = Number(definition.hash);
  if (!hash || output.has(hash)) return;
  output.set(hash, {
    hash,
    name: displayName(definition),
    type: definition.itemTypeDisplayName || '',
    enhanced: isEnhancedPerk(definition),
    icon: iconUrl(definition),
    description: cleanText(displayDescription(definition)),
    category: definition.plug?.plugCategoryIdentifier || '',
    stats: formatInvestmentStats(definition, statDefs)
  });
}

export function isWeaponSocketPlug(definition) {
  const name = displayName(definition);
  if (!name || name === EMPTY_TRAIT_SOCKET || /^空/.test(name)) return false;
  const type = String(definition.itemTypeDisplayName || '');
  const category = String(definition.plug?.plugCategoryIdentifier || '').toLowerCase();
  const blockedText = `${type} ${category}`.toLowerCase();
  if (name === '机密' || type.includes('战斗特效')) return false;
  if (/shader|skin|ornament|tracker|masterwork|memento|kill_counter|catalyst|mod/.test(blockedText)) return false;
  if (type.includes('着色器') || type.includes('皮肤') || type.includes('追踪器') || type.includes('大师杰作') || type.includes('模组')) return false;
  return Boolean(type || displayDescription(definition));
}

export function plugHashesForSocket(socket, plugSets) {
  const hashes = new Set();
  if (socket.singleInitialItemHash) hashes.add(Number(socket.singleInitialItemHash));
  for (const item of socket.reusablePlugItems || []) if (item.plugItemHash) hashes.add(Number(item.plugItemHash));
  for (const item of socket.randomizedPlugItems || []) if (item.plugItemHash) hashes.add(Number(item.plugItemHash));
  for (const plugSetHash of [socket.reusablePlugSetHash, socket.randomizedPlugSetHash]) {
    const set = plugSets[String(plugSetHash)];
    for (const item of set?.reusablePlugItems || []) {
      if (item.plugItemHash) hashes.add(Number(item.plugItemHash));
    }
  }
  return Array.from(hashes);
}

export function makeItemSetMap(itemSets, sandboxPerks) {
  const map = new Map();
  for (const set of Object.values(itemSets || {})) {
    if (!set || set.redacted || !Array.isArray(set.setItems)) continue;
    const entry = {
      hash: Number(set.hash),
      name: displayName(set),
      perks: (set.setPerks || [])
        .map((perk) => {
          const definition = sandboxPerks[String(perk.sandboxPerkHash)] || {};
          return {
            requiredSetCount: Number(perk.requiredSetCount || 0),
            hash: Number(perk.sandboxPerkHash || 0),
            name: displayName(definition) || `${perk.requiredSetCount} 件套`,
            description: cleanText(displayDescription(definition))
          };
        })
        .filter((perk) => perk.requiredSetCount && (perk.name || perk.description))
        .sort((a, b) => a.requiredSetCount - b.requiredSetCount)
    };
    if (!entry.name && !entry.perks.length) continue;
    for (const hash of set.setItems) {
      map.set(Number(hash), entry);
    }
  }
  return map;
}

export function armorIntrinsicPerks(definition, items) {
  const hashes = new Set();
  for (const socket of definition.sockets?.socketEntries || []) {
    if (socket.singleInitialItemHash) hashes.add(Number(socket.singleInitialItemHash));
  }
  return Array.from(hashes)
    .map((hash) => items[String(hash)])
    .filter((plug) => plug && !plug.redacted)
    .filter((plug) => isArmorIntrinsicPlug(plug))
    .map((plug) => ({
      hash: Number(plug.hash),
      name: displayName(plug),
      type: plug.itemTypeDisplayName || '',
      icon: iconUrl(plug),
      description: cleanText(displayDescription(plug))
    }))
    .filter((perk) => perk.name && !/^空/.test(perk.name));
}

export function isArmorIntrinsicPlug(definition) {
  const type = String(definition.itemTypeDisplayName || '');
  const category = String(definition.plug?.plugCategoryIdentifier || '');
  return type.includes('护甲特性') || category === 'intrinsics';
}

export function formatStats(definition, statDefs) {
  const stats = Object.values(definition.stats?.stats || {})
    .map((stat) => {
      const statDef = statDefs[String(stat.statHash)] || {};
      const name = displayName(statDef);
      const value = Number(stat.value || 0);
      const displayMaximum = Number(stat.displayMaximum || stat.maximum || 100);
      return {
        hash: Number(stat.statHash),
        name,
        value,
        displayMaximum,
        sort: Number(statDef.index || 0)
      };
    })
    .filter((stat) => stat.name && stat.value > 0)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'));
  return stats.map(({ sort: _sort, ...stat }) => stat);
}

export function formatInvestmentStats(definition, statDefs) {
  return (definition.investmentStats || [])
    .map((stat) => {
      const statDef = statDefs[String(stat.statTypeHash)] || {};
      const name = displayName(statDef);
      const value = Number(stat.value || 0);
      return {
        hash: Number(stat.statTypeHash),
        name,
        value,
        conditionallyActive: Boolean(stat.isConditionallyActive)
      };
    })
    .filter((stat) => stat.name && stat.value !== 0);
}

export function diffInvestmentStats(normalStats, enhancedStats) {
  const normalByHash = new Map(normalStats.map((stat) => [String(stat.hash), stat]));
  const enhancedByHash = new Map(enhancedStats.map((stat) => [String(stat.hash), stat]));
  const hashes = new Set([...normalByHash.keys(), ...enhancedByHash.keys()]);

  return Array.from(hashes)
    .map((hash) => {
      const normal = normalByHash.get(hash);
      const enhanced = enhancedByHash.get(hash);
      const normalValue = Number(normal?.value || 0);
      const enhancedValue = Number(enhanced?.value || 0);
      return {
        hash: Number(hash),
        name: enhanced?.name || normal?.name || hash,
        normal: normalValue,
        enhanced: enhancedValue,
        delta: enhancedValue - normalValue,
        conditionallyActive: Boolean(enhanced?.conditionallyActive || normal?.conditionallyActive)
      };
    })
    .filter((stat) => stat.delta !== 0);
}

export function perkPairKey(perk) {
  const name = normalizeText(perk?.name || '');
  if (!name) return '';
  const category = normalizeText(perk?.category || basePerkType(perk?.type || ''));
  return `${name}|${category}`;
}

export function basePerkType(type) {
  return cleanText(type)
    .replace(/^强化/, '')
    .replace('特征', '特性')
    .replace('利刃', '刀片')
    .replace('刀柄', '把手');
}

export function weaponSocketLabel(index, perkHashes, items) {
  const perks = perkHashes.map((hash) => items[String(hash)]).filter(Boolean);
  if (perks.some((perk) => String(perk.itemTypeDisplayName || '').includes('固有'))) return '框架 / 固有';
  if (perks.some((perk) => String(perk.itemTypeDisplayName || '').includes('原始'))) return '起源特性';
  const typeCounts = new Map();
  for (const perk of perks) {
    const type = String(perk.itemTypeDisplayName || '').trim();
    if (!type || type === '特性' || type === '强化特征') continue;
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }
  const [type] = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0] || [];
  if (type) return type;
  return `第 ${index + 1} 列`;
}
