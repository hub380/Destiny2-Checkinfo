import { cleanText, normalizeText } from './utils.js';
import { getSourceAliasesIndex, getSourceIndex } from './index-cache.js';
import { compareGearItems, armorSetBonusHashSet } from './search.js';
import { sourceKeyFor } from './split-paths.js';

const SOURCE_TYPE_LABELS = {
  raid: 'Raid 来源',
  dungeon: '地牢来源',
  pvp: 'PvP 来源',
  vendor: 'Vendor 来源',
  seasonal: '赛季来源',
  exotic: '异域来源'
};

export async function tryEncounterSearch(query, deps) {
  const aliasesCached = await getSourceAliasesIndex(deps);
  const aliases = aliasesCached?.value?.aliases;
  if (!aliases || typeof aliases !== 'object') return null;

  const terms = normalizeText(query);

  for (const [sourceText, alias] of Object.entries(aliases)) {
    if (!Array.isArray(alias.encounters) || !alias.encounters.length) continue;

    const sourcePatternsList = [
      normalizeText(alias.zh || sourceText),
      normalizeText(alias.en || ''),
      ...(alias.abbr || []).map(normalizeText)
    ].filter(Boolean);

    let matchedPattern = null;
    for (const pattern of sourcePatternsList) {
      if (pattern && terms.includes(pattern)) {
        matchedPattern = pattern;
        break;
      }
    }
    if (!matchedPattern) continue;

    const remaining = terms.replace(matchedPattern, '').trim();

    for (const encounter of alias.encounters) {
      const encounterPatterns = [
        normalizeText(encounter.zh || ''),
        normalizeText(encounter.en || ''),
        ...(encounter.abbr || []).map(normalizeText)
      ].filter(Boolean);

      if (!encounterPatterns.some((p) => p && remaining.includes(p))) continue;

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

export async function loadSourceAliases(deps) {
  const aliasesCached = await getSourceAliasesIndex(deps);
  const aliases = aliasesCached?.value?.aliases;
  return aliases && typeof aliases === 'object' ? aliases : {};
}

function resolveEncounterItems(sourceFile, sourceEncounter, aliasEncounter) {
  const sourceItems = Array.isArray(sourceFile.items) ? sourceFile.items : [];
  if (!hasEncounterDrops(sourceEncounter) && !hasEncounterDrops(aliasEncounter)) return [];
  return sourceItems.filter((item) => encounterDropsItem(sourceEncounter, item) || encounterDropsItem(aliasEncounter, item));
}

export async function trySourceAliasSearch(query, deps, kind, limit) {
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

export function enrichGearIndexSources(index, aliases) {
  return {
    ...index,
    items: (index.items || []).map((item) => enrichGearItemSources(item, aliases)),
    weapons: (index.weapons || []).map((weapon) => enrichGearItemSources(weapon, aliases)),
    armors: (index.armors || []).map((armor) => enrichGearItemSources(armor, aliases))
  };
}

export function enrichGearItemSources(item, aliases) {
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
