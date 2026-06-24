import { diffInvestmentStats } from './factories.js';
import { perkMap } from './perk-map.js';
import { resolveSocketPerks, perkPairKey } from './factories.js';

export function publicGearItem(item) {
  const { searchText: _searchText, ...publicItem } = item;
  return publicItem;
}

export function publicGearDetail(item, index) {
  if (item.kind === 'weapon') {
    const record = index.weapons.find((weapon) => weapon.hash === item.hash);
    return record ? publicWeaponRecord(record, index) : null;
  }
  if (item.kind === 'armor') {
    const record = (index.armors || []).find((armor) => armor.hash === item.hash) || null;
    return record ? publicArmorRecord(record) : null;
  }
  return null;
}

export function publicArmorRecord(record) {
  return {
    ...record,
    sourceHints: Array.isArray(record.sourceHints) ? record.sourceHints : []
  };
}

export function publicWeaponRecord(record, index, matchedHashes = new Set()) {
  return {
    hash: record.hash,
    name: record.name,
    baseName: record.baseName,
    icon: record.icon,
    weaponType: record.weaponType,
    ammo: record.ammo,
    element: record.element,
    adept: Boolean(record.adept),
    stats: record.stats || [],
    screenshot: record.screenshot || '',
    sourceHints: Array.isArray(record.sourceHints) ? record.sourceHints : [],
    sockets: publicWeaponSockets(record, perkMap(index), matchedHashes)
  };
}

export function publicWeaponSockets(record, perksByHash, matchedHashes = new Set()) {
  return (record.sockets || [])
    .map((socket) => ({
      socketIndex: socket.socketIndex,
      label: socket.label || `第 ${Number(socket.socketIndex || 0) + 1} 列`,
      perks: publicSocketPerks(resolveSocketPerks(socket, perksByHash), matchedHashes)
    }))
    .filter((socket) => socket.perks.length);
}

export function publicSocketPerks(perks, matchedHashes) {
  const normalByKey = new Map();
  const enhancedByKey = new Map();

  for (const perk of perks) {
    const key = perkPairKey(perk);
    if (!key) continue;
    if (perk.enhanced) {
      const entries = enhancedByKey.get(key) || [];
      if (!entries.some((entry) => entry.hash === perk.hash)) entries.push(perk);
      enhancedByKey.set(key, entries);
      continue;
    }
    if (!normalByKey.has(key)) normalByKey.set(key, perk);
  }

  const seenKeys = new Set();
  return perks
    .map((perk) => {
      const key = perkPairKey(perk);
      if (!key) return null;
      if (perk.enhanced && normalByKey.has(key)) return null;
      if (seenKeys.has(key)) return null;
      seenKeys.add(key);

      const enhancedOptions = perk.enhanced ? [] : (enhancedByKey.get(key) || []);
      const enhancedMatched = enhancedOptions.some((entry) => matchedHashes.has(entry.hash));
      return {
        ...publicPerkRef(perk),
        matched: matchedHashes.has(perk.hash) || enhancedMatched,
        enhancedMatched,
        enhancedOptions: enhancedOptions.map((entry) => publicEnhancedPerkRef(perk, entry))
      };
    })
    .filter(Boolean);
}

export function publicPerkRef(perk) {
  return {
    hash: perk.hash,
    name: perk.name,
    type: perk.type,
    enhanced: Boolean(perk.enhanced),
    icon: perk.icon || '',
    description: perk.description || '',
    stats: Array.isArray(perk.stats) ? perk.stats : []
  };
}

export function publicEnhancedPerkRef(normal, enhanced) {
  return {
    ...publicPerkRef(enhanced),
    statDiff: diffInvestmentStats(normal.stats || [], enhanced.stats || []),
    descriptionDiff: enhanced.description && enhanced.description !== normal.description ? enhanced.description : '',
    matched: false
  };
}