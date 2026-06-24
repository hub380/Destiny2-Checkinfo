import { normalizeGearKind, sourceSearchText } from './labels.js';
import { cleanText, clampNumber, httpError, requireApiKey, normalizeText, uniqueByHash } from './utils.js';
import { getGearIndex } from './index-cache.js';
import {
  compareGearItems,
  scoreGearItem,
  armorSetBonusHashSet,
  enrichGearSearchItem
} from './search.js';
import { publicGearItem, publicGearDetail, publicWeaponSockets, publicPerkRef } from './public.js';
import { perkMap } from './perk-map.js';

export async function getGearSearch(body, deps) {
  requireApiKey(deps);
  const query = cleanText(body?.query || body?.name || '');
  if (!query) {
    throw httpError(400, 'INVALID_GEAR_QUERY', '请输入武器、护甲或 perk 名称');
  }

  const kind = normalizeGearKind(body?.kind || body?.type || 'all');
  const limit = clampNumber(body?.limit, 1, 120, 60);
  const cached = await getGearIndex(deps);
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
    .map((item) => publicGearItem(enrichGearSearchItem(item, index, armorSetBonusHashes)));

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

  const cached = await getGearIndex(deps);
  const index = cached.value;
  const item = index.items.find((entry) => String(entry.hash) === hash);
  if (!item) {
    throw httpError(404, 'GEAR_ITEM_NOT_FOUND', '没有找到这个装备');
  }

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: index.manifestVersion,
    item: publicGearItem(item),
    detail: publicGearDetail(item, index),
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

  const limit = clampNumber(body?.limit, 1, 120, 80);
  const cached = await getGearIndex(deps);
  const index = cached.value;
  const terms = normalizeText(query);
  const perkMatches = index.items
    .filter((item) => item.kind === 'perk')
    .filter((item) => (hash ? String(item.hash) === hash : item.searchText.includes(terms)))
    .sort((a, b) => scoreGearItem(a, terms, hash || query) - scoreGearItem(b, terms, hash || query) || a.name.localeCompare(b.name, 'zh-CN'));

  const perkHashes = new Set(perkMatches.map((item) => item.hash));
  const perkByHash = perkMap(index);
  const groups = new Map();

  for (const weapon of index.weapons) {
    const sockets = publicWeaponSockets(weapon, perkByHash, perkHashes);
    const matchedPerks = uniqueByHash(sockets.flatMap((socket) => socket.perks.filter((perk) => perk.matched)));

    if (!matchedPerks.length) continue;

    const key = [weapon.baseName, weapon.weaponType, weapon.ammo, weapon.element].join('|');
    if (!groups.has(key)) {
      groups.set(key, {
        name: weapon.baseName,
        weaponType: weapon.weaponType,
        ammo: weapon.ammo,
        element: weapon.element,
        variants: [],
        canRoll: {
          normal: false,
          enhanced: false
        }
      });
    }

    const group = groups.get(key);
    const variant = {
      hash: weapon.hash,
      name: weapon.name,
      adept: weapon.adept,
      icon: weapon.icon,
      stats: weapon.stats || [],
      screenshot: weapon.screenshot || '',
      sockets,
      matchedPerks: matchedPerks.map(publicPerkRef)
    };
    for (const perk of matchedPerks) {
      group.canRoll.normal = group.canRoll.normal || !perk.enhanced;
      group.canRoll.enhanced = group.canRoll.enhanced || perk.enhanced || perk.enhancedMatched || Boolean(perk.enhancedOptions?.length);
    }
    group.variants.push(variant);
  }

  const weapons = Array.from(groups.values())
    .map((group) => ({
      ...group,
      variants: group.variants.sort((a, b) => Number(a.adept) - Number(b.adept) || a.name.localeCompare(b.name, 'zh-CN'))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit);

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: index.manifestVersion,
    query: query || hash,
    perks: perkMatches.map(publicGearItem),
    total: groups.size,
    weapons,
    cache: {
      gearIndex: cached.status,
      gearIndexCachedAt: cached.cachedAt,
      gearIndexTtlSeconds: cached.ttlSeconds
    }
  };
}
