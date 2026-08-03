import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeText } from './utils.js';
import {
  GEAR_PACKED_SCHEMA_VERSION,
  GEAR_SPLIT_SCHEMA_VERSION,
  craftablesPath,
  dungeonAliasesPath,
  gearItemBucketPath,
  gearItemPath,
  joinGearPath,
  packedBucket,
  perkWeaponsBucketPath,
  perkWeaponsPath,
  raidAliasesPath,
  rollRecommendationsBucketPath,
  safeSegment,
  searchShardPath,
  sourceAliasesPath,
  sourceIndexPath,
  sourceKeyFor,
  uploadManifestPath
} from './split-paths.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { buildRollRecommendations } from './roll-recommendations.js';
import { normalizeLightggRollRecommendations } from './lightgg-recommendations.js';
import { normalizeLightggPerkDetails } from './lightgg-perk-details.js';

export async function writeSplitGearIndex(gearIndex, options = {}) {
  validateGearIndex(gearIndex);
  const outputDir = resolve(options.outputDir || 'public/data/gear');
  const locale = String(gearIndex.locale || options.locale || 'zh-chs').toLowerCase();
  const root = safeSegment(gearIndex.manifestVersion);
  const rootDir = join(outputDir, root);
  const aliases = await readSourceAliases(options.sourceAliasesFile, options.raidAliasesFile, options.dungeonAliasesFile);
  const rollRecommendationOverlays = await readRollRecommendations(
    options.rollRecommendationFiles || options.rollRecommendationsFile
  );
  const perkEffectDetails = await readPerkEffectDetails(options.perkDetailsFile);
  const rollRecommendations = buildRollRecommendations(gearIndex, rollRecommendationOverlays);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(rootDir, { recursive: true });

  const context = createSplitContext(gearIndex, { perkEffectDetails });
  const files = [];

  await writeJson(files, outputDir, join(root, searchShardPath('weapon')), searchShard(gearIndex, 'weapon'));
  await writeJson(files, outputDir, join(root, searchShardPath('armor')), searchShard(gearIndex, 'armor'));
  await writeJson(files, outputDir, join(root, searchShardPath('perk')), {
    schemaVersion: GEAR_SPLIT_SCHEMA_VERSION,
    kind: 'perk',
    locale,
    manifestVersion: gearIndex.manifestVersion,
    items: context.perks
  });

  await mapWithConcurrency(
    gearIndex.items || [],
    64,
    (item) => writeJson(files, outputDir, join(root, gearItemPath(item.hash)), itemRecordFile(item, context))
  );

  await writeJson(files, outputDir, join(root, craftablesPath()), {
    schemaVersion: GEAR_SPLIT_SCHEMA_VERSION,
    kind: 'craftable',
    locale,
    manifestVersion: gearIndex.manifestVersion,
    items: gearIndex.craftables || []
  });

  const perkWeaponsIndexes = buildPerkWeaponsIndexes(gearIndex);
  await mapWithConcurrency(
    perkWeaponsIndexes,
    64,
    (perkWeaponsIndex) => writeJson(files, outputDir, join(root, perkWeaponsPath(perkWeaponsIndex.perkHash)), perkWeaponsIndex)
  );

  const sourceIndexes = buildSourceIndexes(gearIndex, aliases);
  await mapWithConcurrency(
    sourceIndexes,
    64,
    (sourceIndex) => writeJson(files, outputDir, join(root, sourceIndexPath(sourceIndex.sourceKey)), sourceIndex)
  );

  const normalizedAliases = normalizeSourceAliases(aliases);
  await writeJson(files, outputDir, join(root, sourceAliasesPath()), normalizedAliases);
  await writeJson(files, outputDir, join(root, raidAliasesPath()), filterSourceAliasesByType(normalizedAliases, 'raid'));
  await writeJson(files, outputDir, join(root, dungeonAliasesPath()), filterSourceAliasesByType(normalizedAliases, 'dungeon'));

  const packedCounts = await writePackedIndexes(files, outputDir, root, {
    gearIndex,
    context,
    perkWeaponsIndexes,
    sourceIndexes,
    rollRecommendations
  });

  const byteSize = await totalByteSize(files);
  const uploadManifest = await buildUploadManifest(root, files);
  await writeJson(files, outputDir, uploadManifestPath(), uploadManifest, true);

  const latestPointer = {
    schemaVersion: GEAR_PACKED_SCHEMA_VERSION,
    locale,
    manifestVersion: gearIndex.manifestVersion,
    indexVersion: gearIndex.indexVersion || '',
    builtAt: gearIndex.builtAt || null,
    generatedAt: new Date().toISOString(),
    root,
    byteSize,
    counts: {
      items: (gearIndex.items || []).length,
      weapons: (gearIndex.weapons || []).length,
      armors: (gearIndex.armors || []).length,
      perks: context.perks.length,
      craftables: (gearIndex.craftables || []).length,
      itemBuckets: packedCounts.itemBuckets,
      perkWeaponBuckets: packedCounts.perkWeaponBuckets,
      rollBuckets: packedCounts.rollBuckets,
      recommendedWeapons: rollRecommendations.length,
      recommendationSets: rollRecommendations.reduce(
        (sum, entry) => sum + (entry.recommendations?.length || 0),
        0
      ),
      files: files.length
    }
  };
  await writeJson(files, outputDir, 'latest.json', latestPointer, true);

  return {
    latestPointer,
    files
  };
}

export function createSplitContext(gearIndex, options = {}) {
  const perks = mergePerks(gearIndex);
  return {
    gearIndex,
    perks,
    perkEffectDetails: options.perkEffectDetails || new Map(),
    perkByHash: new Map(perks.map((perk) => [Number(perk.hash), perk])),
    weaponByHash: new Map((gearIndex.weapons || []).map((record) => [Number(record.hash), record])),
    armorByHash: new Map((gearIndex.armors || []).map((record) => [Number(record.hash), record]))
  };
}

export function mergePerks(gearIndex) {
  const byHash = new Map();
  for (const item of (gearIndex.items || []).filter((entry) => entry.kind === 'perk')) {
    byHash.set(Number(item.hash), normalizePerkItem(item));
  }
  for (const plug of gearIndex.weaponPlugs || []) {
    byHash.set(Number(plug.hash), normalizePerkItem(plug));
  }
  return Array.from(byHash.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || Number(a.hash) - Number(b.hash));
}

function searchShard(gearIndex, kind) {
  return {
    schemaVersion: GEAR_SPLIT_SCHEMA_VERSION,
    kind,
    locale: gearIndex.locale || 'zh-chs',
    manifestVersion: gearIndex.manifestVersion,
    items: (gearIndex.items || []).filter((item) => item.kind === kind)
  };
}

function itemRecordFile(item, context) {
  const itemRecord = item.kind === 'weapon'
    ? expandedWeaponRecord(context.weaponByHash.get(Number(item.hash)), context.perkByHash, context.perkEffectDetails)
    : item.kind === 'armor'
      ? context.armorByHash.get(Number(item.hash)) || null
      : null;

  return {
    schemaVersion: GEAR_SPLIT_SCHEMA_VERSION,
    locale: context.gearIndex.locale || 'zh-chs',
    manifestVersion: context.gearIndex.manifestVersion,
    kind: item.kind,
    hash: Number(item.hash),
    item,
    itemRecord
  };
}

function expandedWeaponRecord(weaponRecord, perkByHash, perkEffectDetails = new Map()) {
  if (!weaponRecord) return null;
  return {
    ...weaponRecord,
    sockets: (weaponRecord.sockets || []).map((socket) => ({
      ...socket,
      perks: (socket.perks || [])
        .map((hash) => (typeof hash === 'number' ? perkByHash.get(hash) : perkByHash.get(Number(hash?.hash)) || hash))
        .filter(Boolean)
        .map((perk) => withPerkEffectDetails(perk, perkEffectDetails))
    }))
  };
}

function withPerkEffectDetails(perk, perkEffectDetails) {
  const effectDetails = perkEffectDetails.get(Number(perk.hash));
  return effectDetails ? { ...perk, effectDetails } : perk;
}

function buildPerkWeaponsIndexes(gearIndex) {
  const groupsByPerkHash = new Map();
  for (const weaponRecord of gearIndex.weapons || []) {
    const sockets = lightWeaponSockets(weaponRecord);
    const perkHashes = new Set(sockets.flatMap((socket) => socket.perks || []));
    for (const perkHash of perkHashes) {
      const groups = groupsByPerkHash.get(perkHash) || new Map();
      const groupKey = [weaponRecord.baseName, weaponRecord.weaponType, weaponRecord.ammo, weaponRecord.element].join('|');
      const group = groups.get(groupKey) || {
        name: weaponRecord.baseName,
        weaponType: weaponRecord.weaponType,
        ammo: weaponRecord.ammo,
        element: weaponRecord.element,
        variants: []
      };
      if (!group.variants.some((variant) => Number(variant.hash) === Number(weaponRecord.hash))) {
        group.variants.push({
          hash: weaponRecord.hash,
          name: weaponRecord.name,
          adept: Boolean(weaponRecord.adept),
          icon: weaponRecord.icon || ''
        });
      }
      groups.set(groupKey, group);
      groupsByPerkHash.set(perkHash, groups);
    }
  }

  return Array.from(groupsByPerkHash.entries()).map(([perkHash, groups]) => ({
    schemaVersion: GEAR_SPLIT_SCHEMA_VERSION,
    locale: gearIndex.locale || 'zh-chs',
    manifestVersion: gearIndex.manifestVersion,
    perkHash,
    weapons: Array.from(groups.values()).map((group) => ({
      ...group,
      variants: group.variants.sort((a, b) => Number(a.adept) - Number(b.adept) || a.name.localeCompare(b.name, 'zh-CN'))
    }))
  }));
}

function lightWeaponSockets(weaponRecord) {
  return (weaponRecord.sockets || [])
    .map((socket) => ({
      socketIndex: socket.socketIndex,
      label: socket.label || '',
      perks: (socket.perks || [])
        .map((entry) => Number(typeof entry === 'number' ? entry : entry?.hash))
        .filter(Number.isFinite)
    }))
    .filter((socket) => socket.perks.length);
}

function buildSourceIndexes(gearIndex, aliases) {
  const sourceIndexes = new Map();
  for (const item of gearIndex.items || []) {
    for (const hint of item.sourceHints || []) {
      const sourceText = String(hint?.text || '').trim();
      if (!sourceText) continue;
      const sourceKey = sourceKeyFor(sourceText);
      const sourceIndex = sourceIndexes.get(sourceKey) || {
        schemaVersion: GEAR_SPLIT_SCHEMA_VERSION,
        locale: gearIndex.locale || 'zh-chs',
        manifestVersion: gearIndex.manifestVersion,
        sourceKey,
        sourceText,
        items: [],
        encounters: []
      };
      if (!sourceIndex.items.some((entry) => Number(entry.hash) === Number(item.hash))) {
        sourceIndex.items.push(item);
      }
      sourceIndexes.set(sourceKey, sourceIndex);
    }
  }

  // Enrich source indexes with encounter drop hashes from human overlay
  const aliasMap = aliases?.aliases;
  if (aliasMap && typeof aliasMap === 'object') {
    // Build item name to hash lookup for drop resolution
    const itemByName = new Map();
    for (const item of gearIndex.items || []) {
      if (item.name) itemByName.set(normalizeText(item.name), Number(item.hash));
    }

    // Build alias lookup by normalized source text key
    const aliasLookup = new Map();
    for (const [key, aliasData] of Object.entries(aliasMap)) {
      if (Array.isArray(aliasData?.encounters) && aliasData.encounters.length) {
        aliasLookup.set(normalizeText(key), aliasData);
      }
    }

    for (const sourceIndex of sourceIndexes.values()) {
      const aliasData = aliasLookup.get(normalizeText(sourceIndex.sourceText));
      if (!aliasData) continue;
      sourceIndex.encounters = aliasData.encounters
        .map((encounter) => ({
          key: encounter.key,
          zh: encounter.zh || '',
          en: encounter.en || '',
          abbr: encounter.abbr || [],
          drops: (encounter.drops || [])
            .map((drop) => itemByName.get(normalizeText(drop.name || '')))
            .filter(Boolean)
        }))
        .filter((e) => e.key);
    }
  }

  return Array.from(sourceIndexes.values());
}

async function writePackedIndexes(files, outputDir, root, payload) {
  const { gearIndex, context, perkWeaponsIndexes, sourceIndexes, rollRecommendations } = payload;
  const locale = gearIndex.locale || 'zh-chs';
  const manifestVersion = gearIndex.manifestVersion;
  const itemBuckets = new Map();
  const perkWeaponBuckets = new Map();
  const rollBuckets = buildRollRecommendationBuckets(rollRecommendations, locale, manifestVersion);

  for (const item of gearIndex.items || []) {
    if (item.kind !== 'weapon' && item.kind !== 'armor') continue;
    const bucket = packedBucket(item.hash);
    const file = itemBuckets.get(bucket) || {
      schemaVersion: GEAR_PACKED_SCHEMA_VERSION,
      kind: 'items',
      locale,
      manifestVersion,
      bucket,
      items: {}
    };
    file.items[String(item.hash)] = itemRecordFile(item, context);
    itemBuckets.set(bucket, file);
  }

  for (const perkWeaponsIndex of perkWeaponsIndexes || []) {
    const bucket = packedBucket(perkWeaponsIndex.perkHash);
    const file = perkWeaponBuckets.get(bucket) || {
      schemaVersion: GEAR_PACKED_SCHEMA_VERSION,
      kind: 'perk-weapons',
      locale,
      manifestVersion,
      bucket,
      perks: {}
    };
    file.perks[String(perkWeaponsIndex.perkHash)] = perkWeaponsIndex;
    perkWeaponBuckets.set(bucket, file);
  }

  await mapWithConcurrency(
    Array.from(itemBuckets.values()),
    32,
    (bucketFile) => writeJson(files, outputDir, join(root, gearItemBucketPath(bucketFile.bucket)), bucketFile)
  );
  await mapWithConcurrency(
    Array.from(perkWeaponBuckets.values()),
    32,
    (bucketFile) => writeJson(files, outputDir, join(root, perkWeaponsBucketPath(bucketFile.bucket)), bucketFile)
  );
  await mapWithConcurrency(
    Array.from(rollBuckets.values()),
    32,
    (bucketFile) => writeJson(files, outputDir, join(root, rollRecommendationsBucketPath(bucketFile.bucket)), bucketFile)
  );

  await writeJson(files, outputDir, join(root, 'sources/raids.json'), sourceCollectionFile(sourceIndexes, 'raid', locale, manifestVersion));
  await writeJson(files, outputDir, join(root, 'sources/dungeons.json'), sourceCollectionFile(sourceIndexes, 'dungeon', locale, manifestVersion));
  await writeJson(files, outputDir, join(root, 'sources/activities.json'), sourceCollectionFile(sourceIndexes, 'activity', locale, manifestVersion));
  await writeJson(files, outputDir, join(root, 'sources/other.json'), sourceCollectionFile(sourceIndexes, 'other', locale, manifestVersion));

  return {
    itemBuckets: itemBuckets.size,
    perkWeaponBuckets: perkWeaponBuckets.size,
    rollBuckets: rollBuckets.size
  };
}

function sourceCollectionFile(sourceIndexes, type, locale, manifestVersion) {
  return {
    schemaVersion: GEAR_PACKED_SCHEMA_VERSION,
    kind: 'sources',
    sourceType: type,
    locale,
    manifestVersion,
    sources: (sourceIndexes || []).filter((sourceIndex) => {
      const sourceType = sourceIndex.sourceType || sourceIndex.type || 'other';
      if (type === 'other') return !['raid', 'dungeon', 'activity'].includes(sourceType);
      return sourceType === type;
    })
  };
}

export function buildRollRecommendationBuckets(rollRecommendations, locale, manifestVersion) {
  const buckets = new Map();
  for (const entry of rollRecommendations) {
    const weaponHash = Number(entry.weaponHash || entry.hash);
    if (!Number.isFinite(weaponHash)) continue;
    const bucket = packedBucket(weaponHash);
    const file = buckets.get(bucket) || {
      schemaVersion: GEAR_PACKED_SCHEMA_VERSION,
      kind: 'roll-recommendations',
      locale,
      manifestVersion,
      bucket,
      items: {}
    };
    file.items[String(weaponHash)] = normalizeRollRecommendationEntry(entry, weaponHash);
    buckets.set(bucket, file);
  }
  return buckets;
}

function normalizeRollRecommendationEntry(entry, weaponHash) {
  return {
    weaponHash,
    recommendations: Array.isArray(entry.recommendations)
      ? entry.recommendations.map(normalizeRollRecommendation).filter(Boolean)
      : []
  };
}

function normalizeRollRecommendation(entry, index) {
  if (!entry || typeof entry !== 'object') return null;
  const mode = ['pve', 'pvp'].includes(String(entry.mode || '').toLowerCase())
    ? String(entry.mode).toLowerCase()
    : 'general';
  return {
    id: String(entry.id || `${mode}-${index}`),
    mode,
    label: String(entry.label || mode.toUpperCase()),
    source: String(entry.source || 'manual'),
    sourceUrl: String(entry.sourceUrl || ''),
    confidence: String(entry.confidence || 'curated'),
    notes: String(entry.notes || ''),
    sockets: Array.isArray(entry.sockets)
      ? entry.sockets.map(normalizeRollSocket).filter(Boolean)
      : []
  };
}

function normalizeRollSocket(socket) {
  if (!socket || typeof socket !== 'object') return null;
  const perkHashes = (socket.perkHashes || [])
    .map((hash) => Number(hash))
    .filter(Number.isFinite);
  if (!perkHashes.length) return null;
  return {
    socketIndex: Number(socket.socketIndex || 0),
    label: String(socket.label || ''),
    role: String(socket.role || 'recommended'),
    perkHashes
  };
}

async function readRollRecommendations(filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  const output = [];
  for (const filePath of paths.filter(Boolean)) {
    if (!filePath || !existsSync(filePath)) continue;
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    output.push(...rollRecommendationsFromFile(raw, filePath));
  }
  return output;
}

function rollRecommendationsFromFile(raw, filePath) {
  const source = String(raw?.source || raw?.kind || '').toLowerCase();
  if (source === 'light.gg' || source === 'lightgg' || filePath.includes('lightgg')) {
    return normalizeLightggRollRecommendations(raw);
  }
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (raw?.items && typeof raw.items === 'object') return Object.values(raw.items);
  return [];
}

async function buildUploadManifest(root, files) {
  const entries = {};
  for (const file of files) {
    const body = await readFile(file.absolutePath);
    entries[file.relativePath] = {
      sha256: createHash('sha256').update(body).digest('hex'),
      size: body.length,
      r2Key: joinGearPath(file.relativePath)
    };
  }
  return {
    schemaVersion: GEAR_PACKED_SCHEMA_VERSION,
    root,
    generatedAt: new Date().toISOString(),
    files: entries
  };
}

async function readPerkEffectDetails(filePath) {
  if (!filePath || !existsSync(filePath)) return new Map();
  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  return normalizeLightggPerkDetails(raw);
}

function normalizePerkItem(item) {
  const normalized = {
    kind: 'perk',
    hash: Number(item.hash),
    name: item.name || '',
    icon: item.icon || '',
    type: item.type || '',
    enhanced: Boolean(item.enhanced),
    description: item.description || '',
    category: item.category || '',
    stats: Array.isArray(item.stats) ? item.stats : []
  };
  if (Array.isArray(item.championCounters) && item.championCounters.length) {
    normalized.championCounters = item.championCounters;
  }
  return {
    ...normalized,
    searchText: item.searchText || normalizeText([normalized.name, normalized.type, normalized.description, normalized.hash].filter(Boolean).join(' '))
  };
}

async function readSourceAliases(...filePaths) {
  const merged = { schemaVersion: 1, aliases: {} };
  for (const filePath of filePaths.filter(Boolean)) {
    if (!filePath || !existsSync(filePath)) continue;
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    if (raw?.schemaVersion) merged.schemaVersion = raw.schemaVersion;
    Object.assign(merged.aliases, raw?.aliases || {});
  }
  return merged;
}

function normalizeSourceAliases(value) {
  if (!value || typeof value !== 'object') {
    return { schemaVersion: 1, aliases: {} };
  }
  return {
    schemaVersion: Number(value.schemaVersion || 1),
    aliases: value.aliases && typeof value.aliases === 'object' ? value.aliases : {}
  };
}

function filterSourceAliasesByType(value, type) {
  const normalized = normalizeSourceAliases(value);
  return {
    ...normalized,
    aliases: Object.fromEntries(
      Object.entries(normalized.aliases).filter(([, alias]) => alias?.type === type)
    )
  };
}

async function writeJson(files, outputDir, relativePath, value, pretty = false) {
  const absolutePath = join(outputDir, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(value, null, pretty ? 2 : 0), 'utf8');
  files.push({
    relativePath: relativePath.replace(/\\/g, '/'),
    absolutePath,
    r2Key: joinGearPath(relativePath)
  });
}

async function totalByteSize(files) {
  let total = 0;
  for (const file of files) {
    total += (await stat(file.absolutePath)).size;
  }
  return total;
}

function validateGearIndex(gearIndex) {
  if (!gearIndex || !Array.isArray(gearIndex.items) || !Array.isArray(gearIndex.weapons)) {
    throw new Error('Invalid gear index: missing items or weapons');
  }
  if (!gearIndex.manifestVersion) {
    throw new Error('Invalid gear index: missing manifestVersion');
  }
}
