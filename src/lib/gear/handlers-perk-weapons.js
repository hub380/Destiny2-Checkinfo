import { normalizeText, uniqueByHash } from './utils.js';
import { getGearPerksIndex, getOptionalPerkWeaponsIndex, getGearItemIndex } from './index-cache.js';
import { publicGearItem, publicWeaponSockets, publicPerkRef } from './public.js';
import { perkMap } from './perk-map.js';
import { scoreGearItem } from './search.js';

export async function buildPerkWeapons(deps, query, hash, limit, offset = 0) {
  const cached = await getGearPerksIndex(deps);
  const index = cached.value;
  const terms = normalizeText(query);
  const perkMatches = index.items
    .filter((item) => item.kind === 'perk')
    .filter((item) => (hash ? String(item.hash) === hash : item.searchText.includes(terms)))
    .sort((a, b) => scoreGearItem(a, terms, hash || query) - scoreGearItem(b, terms, hash || query) || a.name.localeCompare(b.name, 'zh-CN'));

  const perkHashes = new Set(perkMatches.map((item) => item.hash));
  const perkByHash = perkMap(index);
  const groups = new Map();
  const perkWeaponsIndexes = await Promise.all(
    Array.from(perkHashes).map((perkHash) => getOptionalPerkWeaponsIndex(deps, perkHash))
  );

  for (const perkWeaponsIndex of perkWeaponsIndexes) {
    for (const group of perkWeaponsIndex.value?.weapons || []) {
      const key = [group.name, group.weaponType, group.ammo, group.element].join('|');
      if (!groups.has(key)) {
        groups.set(key, {
          name: group.name,
          weaponType: group.weaponType,
          ammo: group.ammo,
          element: group.element,
          variants: []
        });
      }

      const outputGroup = groups.get(key);
      for (const weapon of group.variants || []) {
        if (outputGroup.variants.some((variant) => Number(variant.hash) === Number(weapon.hash))) continue;
        outputGroup.variants.push(weapon);
      }
    }
  }

  const sortedGroups = Array.from(groups.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  const selectedGroups = sortedGroups.slice(offset, offset + limit);
  const weapons = (await Promise.all(selectedGroups.map(async (group) => {
    const outputGroup = await buildPerkWeaponOutputGroup(group, deps, perkByHash, perkHashes);
    return outputGroup.variants.length ? outputGroup : null;
  }))).filter(Boolean);

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: index.manifestVersion,
    query: query || hash,
    hash,
    perks: perkMatches.map(publicGearItem),
    total: groups.size,
    limit,
    offset,
    hasMore: offset + limit < groups.size,
    weapons,
    cache: {
      gearIndex: cached.status,
      gearIndexCachedAt: cached.cachedAt,
      gearIndexTtlSeconds: cached.ttlSeconds
    }
  };
}

export function withPerkWeaponsCacheMeta(payload, cached) {
  return {
    ...(payload || {}),
    cache: {
      ...(payload?.cache || {}),
      perkWeapons: cached.status,
      perkWeaponsCachedAt: cached.cachedAt,
      perkWeaponsTtlSeconds: cached.ttlSeconds
    }
  };
}

async function buildPerkWeaponOutputGroup(group, deps, perkByHash, perkHashes) {
  const outputGroup = {
    ...group,
    variants: [],
    canRoll: {
      normal: false,
      enhanced: false
    }
  };
  const variants = [...group.variants].sort((a, b) => Number(a.adept) - Number(b.adept) || a.name.localeCompare(b.name, 'zh-CN'));
  const outputVariants = await Promise.all(variants.map((weapon) => buildPerkWeaponVariant(weapon, deps, perkByHash, perkHashes)));

  for (const entry of outputVariants) {
    if (!entry) continue;
    outputGroup.variants.push(entry.variant);
    outputGroup.canRoll.normal = outputGroup.canRoll.normal || entry.canRoll.normal;
    outputGroup.canRoll.enhanced = outputGroup.canRoll.enhanced || entry.canRoll.enhanced;
  }

  return outputGroup;
}

async function buildPerkWeaponVariant(weapon, deps, perkByHash, perkHashes) {
  const weaponRecord = await loadPerkWeaponRecord(deps, weapon);
  const sockets = publicWeaponSockets(weaponRecord, perkByHash, perkHashes);
  const matchedPerks = uniqueByHash(sockets.flatMap((socket) => socket.perks.filter((perk) => perk.matched)));
  if (!matchedPerks.length) return null;
  const canRoll = {
    normal: false,
    enhanced: false
  };
  for (const perk of matchedPerks) {
    canRoll.normal = canRoll.normal || !perk.enhanced;
    canRoll.enhanced = canRoll.enhanced || perk.enhanced || perk.enhancedMatched || Boolean(perk.enhancedOptions?.length);
  }
  return {
    variant: {
      hash: weapon.hash,
      name: weapon.name,
      adept: weapon.adept,
      icon: weapon.icon,
      stats: weapon.stats || weaponRecord.stats || [],
      screenshot: '',
      sockets,
      matchedPerks: matchedPerks.map(publicPerkRef)
    },
    canRoll
  };
}

async function loadPerkWeaponRecord(deps, weapon) {
  if (Array.isArray(weapon.sockets)) return weapon;
  const cached = await getGearItemIndex(deps, weapon.hash);
  return cached.value.weapons[0] || weapon;
}
