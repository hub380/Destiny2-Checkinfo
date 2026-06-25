import { normalizeGearKind, sourceSearchText } from './labels.js';
import { cleanText, clampNumber, httpError, requireApiKey, normalizeText, uniqueByHash } from './utils.js';
import {
  getGearItemIndex,
  getGearPerksIndex,
  getGearSearchIndex,
  getOptionalPerkWeaponsIndex,
  getSourceAliasesIndex,
  getSourceIndex
} from './index-cache.js';
import {
  compareGearItems,
  scoreGearItem,
  armorSetBonusHashSet,
  enrichGearSearchItem
} from './search.js';
import { publicGearItem, publicGearDetail, publicWeaponSockets, publicPerkRef } from './public.js';
import { perkMap } from './perk-map.js';
import { sourceKeyFor } from './split-paths.js';

const SOURCE_TYPE_LABELS = {
  raid: 'Raid 来源',
  dungeon: '地牢来源',
  pvp: 'PvP 来源',
  vendor: 'Vendor 来源',
  seasonal: '赛季来源',
  exotic: '异域来源'
};

export async function getGearSearch(body, deps) {
  requireApiKey(deps);
  const query = cleanText(body?.query || body?.name || '');
  if (!query) {
    throw httpError(400, 'INVALID_GEAR_QUERY', '请输入武器、护甲或 perk 名称');
  }

  const kind = normalizeGearKind(body?.kind || body?.type || 'all');
  const limit = clampNumber(body?.limit, 1, 120, 60);
  const aliases = await loadSourceAliases(deps);

  // Try encounter-specific query first (e.g. "国王的陨落 战争祭司")
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

async function tryEncounterSearch(query, deps) {
  const aliasesCached = await getSourceAliasesIndex(deps);
  const aliases = aliasesCached?.value?.aliases;
  if (!aliases || typeof aliases !== 'object') return null;

  const terms = normalizeText(query);

  for (const [sourceText, alias] of Object.entries(aliases)) {
    if (!Array.isArray(alias.encounters) || !alias.encounters.length) continue;

    const sourcePatterns = [
      normalizeText(alias.zh || sourceText),
      normalizeText(alias.en || ''),
      ...(alias.abbr || []).map(normalizeText)
    ].filter(Boolean);

    let matchedPattern = null;
    for (const pattern of sourcePatterns) {
      if (pattern && terms.includes(pattern)) {
        matchedPattern = pattern;
        break;
      }
    }
    if (!matchedPattern) continue;

    // Source matched — look for encounter keyword in remainder
    const remaining = terms.replace(matchedPattern, '').trim();

    for (const encounter of alias.encounters) {
      const encounterPatterns = [
        normalizeText(encounter.zh || ''),
        normalizeText(encounter.en || ''),
        ...(encounter.abbr || []).map(normalizeText)
      ].filter(Boolean);

      if (!encounterPatterns.some((p) => p && remaining.includes(p))) continue;

      // Both source and encounter matched — load source file
      const sourceCached = await loadSourceIndexForAlias(deps, sourceText, alias);
      if (!sourceCached?.value) return null;

      const sourceFile = sourceCached.value;
      const matchedEncounter = sourceFile.encounters?.find((e) => e.key === encounter.key);
      const items = resolveEncounterItems(sourceFile, matchedEncounter, encounter);

      return {
        items,
        total: items.length,
        sourceText,
        encounterZh: encounter.zh,
        encounterKey: encounter.key,
        manifestVersion: sourceFile.manifestVersion
      };
    }
  }

  return null;
}

async function loadSourceAliases(deps) {
  const aliasesCached = await getSourceAliasesIndex(deps);
  const aliases = aliasesCached?.value?.aliases;
  return aliases && typeof aliases === 'object' ? aliases : {};
}

function resolveEncounterItems(sourceFile, sourceEncounter, aliasEncounter) {
  const sourceItems = Array.isArray(sourceFile.items) ? sourceFile.items : [];
  if (!hasEncounterDrops(sourceEncounter) && !hasEncounterDrops(aliasEncounter)) return [];
  return sourceItems.filter((item) => encounterDropsItem(sourceEncounter, item) || encounterDropsItem(aliasEncounter, item));
}

async function trySourceAliasSearch(query, deps, kind, limit) {
  const aliasesCached = await getSourceAliasesIndex(deps);
  const aliases = aliasesCached?.value?.aliases;
  if (!aliases || typeof aliases !== 'object') return null;

  const terms = normalizeText(query);
  for (const [sourceText, alias] of Object.entries(aliases)) {
    if (!matchesSourceAlias(terms, sourceText, alias)) continue;

    const sourceCached = await loadSourceIndexForAlias(deps, sourceText, alias);
    const sourceFile = sourceCached?.value;
    if (!sourceFile) continue;

    const sourceItems = Array.isArray(sourceFile.items) ? sourceFile.items : [];
    const candidates = sourceItems.filter((item) => kind === 'all' || item.kind === kind);
    const armorSetBonusHashes = armorSetBonusHashSet({ armors: [] });
    const items = candidates
      .sort((a, b) => compareGearItems(a, b, terms, query, armorSetBonusHashes))
      .slice(0, limit);

    return {
      items,
      total: candidates.length,
      sourceText: sourceFile.sourceText || sourceText,
      sourceZh: alias?.zh || sourceFile.sourceText || sourceText,
      sourceType: alias?.type || '',
      manifestVersion: sourceFile.manifestVersion,
      cacheStatus: sourceCached.status
    };
  }

  return null;
}

async function loadSourceIndexForAlias(deps, sourceText, alias) {
  const directSourceKey = cleanText(alias?.sourceKey || '');
  if (directSourceKey) {
    const cached = await getSourceIndex(deps, directSourceKey);
    if (cached?.value) return cached;
  }

  for (const candidate of sourceTextCandidates(sourceText, alias)) {
    const cached = await getSourceIndex(deps, sourceKeyFor(candidate));
    if (cached?.value) return cached;
  }

  return null;
}

function matchesSourceAlias(terms, sourceText, alias) {
  return sourcePatterns(sourceText, alias).some((pattern) => pattern && terms.includes(pattern));
}

function sourceTextCandidates(sourceText, alias) {
  return uniqueStrings([
    sourceText,
    alias?.sourceText,
    alias?.zh,
    alias?.en,
    ...(Array.isArray(alias?.sourceTexts) ? alias.sourceTexts : [])
  ]);
}

function sourcePatterns(sourceText, alias) {
  return uniqueStrings([
    sourceText,
    alias?.zh,
    alias?.en,
    ...(Array.isArray(alias?.abbr) ? alias.abbr : [])
  ]).map(normalizeText).filter(Boolean);
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = cleanText(value || '');
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
  }
  return output;
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

  const limit = clampNumber(body?.limit, 1, 120, 80);
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

  for (const perkHash of perkHashes) {
    const perkWeaponsIndex = await getOptionalPerkWeaponsIndex(deps, perkHash);
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

  const selectedGroups = Array.from(groups.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit);
  const weapons = [];

  for (const group of selectedGroups) {
    const outputGroup = {
      ...group,
      variants: [],
      canRoll: {
        normal: false,
        enhanced: false
      }
    };
    const variants = group.variants.sort((a, b) => Number(a.adept) - Number(b.adept) || a.name.localeCompare(b.name, 'zh-CN'));
    for (const weapon of variants) {
      const weaponRecord = await loadPerkWeaponRecord(deps, weapon);
      const sockets = publicWeaponSockets(weaponRecord, perkByHash, perkHashes);
      const matchedPerks = uniqueByHash(sockets.flatMap((socket) => socket.perks.filter((perk) => perk.matched)));
      if (!matchedPerks.length) continue;
      const variant = {
        hash: weapon.hash,
        name: weapon.name,
        adept: weapon.adept,
        icon: weapon.icon,
        stats: weapon.stats || weaponRecord.stats || [],
        screenshot: '',
        sockets,
        matchedPerks: matchedPerks.map(publicPerkRef)
      };
      for (const perk of matchedPerks) {
        outputGroup.canRoll.normal = outputGroup.canRoll.normal || !perk.enhanced;
        outputGroup.canRoll.enhanced = outputGroup.canRoll.enhanced || perk.enhanced || perk.enhancedMatched || Boolean(perk.enhancedOptions?.length);
      }
      outputGroup.variants.push(variant);
    }
    if (outputGroup.variants.length) weapons.push(outputGroup);
  }

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

function enrichGearIndexSources(index, aliases) {
  return {
    ...index,
    items: (index.items || []).map((item) => enrichGearItemSources(item, aliases)),
    weapons: (index.weapons || []).map((weapon) => enrichGearItemSources(weapon, aliases)),
    armors: (index.armors || []).map((armor) => enrichGearItemSources(armor, aliases))
  };
}

function enrichGearItemSources(item, aliases) {
  if (!item || !Array.isArray(item.sourceHints) || !item.sourceHints.length) return item;
  return {
    ...item,
    sourceHints: item.sourceHints.map((hint) => enrichSourceHint(hint, aliases, item))
  };
}

function enrichSourceHint(hint, aliases, item) {
  const match = findSourceAlias(hint?.text, aliases);
  if (!match) return hint;
  const alias = match.alias;
  const encounters = sourceAliasEncounters(item, alias);
  return {
    ...hint,
    label: SOURCE_TYPE_LABELS[alias.type] || hint.label,
    text: alias.zh || hint.text,
    sourceAlias: {
      sourceText: match.sourceText,
      type: alias.type || '',
      zh: alias.zh || '',
      en: alias.en || '',
      abbr: Array.isArray(alias.abbr) ? alias.abbr : []
    },
    ...(encounters.length ? { encounters } : {})
  };
}

function sourceAliasEncounters(item, alias) {
  if (!Array.isArray(alias?.encounters) || !item) return [];
  const seen = new Set();
  const output = [];
  for (const encounter of alias.encounters) {
    if (!encounterDropsItem(encounter, item)) continue;
    const key = cleanText(encounter.key || encounter.zh || encounter.en || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({
      key,
      label: cleanText(encounter.zh || encounter.en || key),
      zh: cleanText(encounter.zh || ''),
      en: cleanText(encounter.en || '')
    });
  }
  return output;
}

function hasEncounterDrops(encounter) {
  return Array.isArray(encounter?.drops) && encounter.drops.length > 0;
}

function encounterDropsItem(encounter, item) {
  if (!hasEncounterDrops(encounter) || !item) return false;
  return encounter.drops.some((drop) => dropMatchesItem(drop, item));
}

function dropMatchesItem(drop, item) {
  if (!drop || !item) return false;
  const dropHash = typeof drop === 'object' ? Number(drop.hash) : Number(drop);
  if (Number.isFinite(dropHash) && dropHash === Number(item.hash)) return true;

  const dropNames = dropNamesFor(drop);
  if (!dropNames.length) return false;
  const itemNames = itemNamesFor(item);
  return dropNames.some((dropName) => itemNames.some((itemName) => itemName === dropName || itemName.includes(dropName)));
}

function dropNamesFor(drop) {
  if (typeof drop === 'string') return [normalizeText(drop)].filter(Boolean);
  if (!drop || typeof drop !== 'object') return [];
  return [drop.name, drop.zh, drop.en]
    .map(normalizeText)
    .filter(Boolean);
}

function itemNamesFor(item) {
  return [item.name, item.baseName, item.en]
    .map(normalizeText)
    .filter(Boolean);
}

function findSourceAlias(value, aliases) {
  const terms = normalizeText(value || '');
  if (!terms) return null;
  for (const [sourceText, alias] of Object.entries(aliases || {})) {
    const patterns = sourcePatterns(sourceText, alias);
    if (patterns.some((pattern) => terms.includes(pattern) || pattern.includes(terms))) {
      return { sourceText, alias };
    }
  }
  return null;
}

async function loadPerkWeaponRecord(deps, weapon) {
  if (Array.isArray(weapon.sockets)) return weapon;
  const cached = await getGearItemIndex(deps, weapon.hash);
  return cached.value.weapons[0] || weapon;
}
