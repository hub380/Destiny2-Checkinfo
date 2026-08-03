import { GEAR_INDEX_VERSION } from './constants.js';
import { httpError } from './utils.js';
import {
  GEAR_SPLIT_PREFIX,
  gearItemBucketPath,
  gearItemPath,
  joinGearPath,
  perkWeaponsBucketPath,
  perkWeaponsPath,
  rollRecommendationsBucketPath,
  searchShardPath,
  sourceAliasesPath,
  sourceIndexPath
} from './split-paths.js';

const GEAR_INDEX_NOT_FOUND_MESSAGE = 'Gear index not found. Run npm run gear:index locally, or publish v2 gear data to R2 before deploying.';

export async function getGearSearchIndex(deps, kind) {
  const kinds = kind === 'all' ? ['weapon', 'armor', 'perk'] : [kind];
  const shards = await Promise.all(kinds.map((entry) => readRequiredGearJson(deps, searchShardPath(entry))));
  const items = shards.flatMap((shard) => Array.isArray(shard.items) ? shard.items : []);
  return withMeta(deps, shards, {
    items,
    weapons: [],
    armors: [],
    weaponPlugs: [],
    manifestVersion: firstValue(shards, 'manifestVersion'),
    locale: firstValue(shards, 'locale')
  });
}

export async function getGearPerksIndex(deps) {
  const shard = await readRequiredGearJson(deps, searchShardPath('perk'));
  return withMeta(deps, [shard], {
    items: Array.isArray(shard.items) ? shard.items : [],
    weapons: [],
    armors: [],
    weaponPlugs: [],
    manifestVersion: shard.manifestVersion,
    locale: shard.locale
  });
}

export async function getGearItemIndex(deps, hash) {
  const latestPointer = await getLatestPointer(deps);
  const packed = isPackedPointer(latestPointer)
    ? await readOptionalGearJsonWithPointer(deps, latestPointer, gearItemBucketPath(hash))
    : { value: null };
  const packedItem = packed.value?.items?.[String(hash)] || null;
  const itemFile = packedItem || await readRequiredGearJsonWithPointer(deps, latestPointer, gearItemPath(hash));
  if (!itemFile?.item) {
    throw httpError(404, 'GEAR_ITEM_NOT_FOUND', 'Gear item not found');
  }
  const itemRecord = itemFile.itemRecord || null;
  const index = {
    items: [itemFile.item],
    weapons: itemFile.kind === 'weapon' && itemRecord ? [itemRecord] : [],
    armors: itemFile.kind === 'armor' && itemRecord ? [itemRecord] : [],
    weaponPlugs: [],
    manifestVersion: itemFile.manifestVersion,
    locale: itemFile.locale
  };
  return withMeta(deps, [{ ...itemFile, cacheMeta: packedItem ? cacheMeta(packed) : itemFile.cacheMeta }], index);
}

export async function getPerkWeaponsIndex(deps, perkHash) {
  const latestPointer = await getLatestPointer(deps);
  const packed = isPackedPointer(latestPointer)
    ? await readOptionalGearJsonWithPointer(deps, latestPointer, perkWeaponsBucketPath(perkHash))
    : { value: null };
  const packedIndex = packed.value?.perks?.[String(perkHash)] || null;
  const index = packedIndex || await readRequiredGearJsonWithPointer(deps, latestPointer, perkWeaponsPath(perkHash));
  return withMeta(deps, [{ ...index, cacheMeta: packedIndex ? cacheMeta(packed) : index.cacheMeta }], index);
}

export async function getOptionalPerkWeaponsIndex(deps, perkHash) {
  const latestPointer = await getLatestPointer(deps);
  const packed = isPackedPointer(latestPointer)
    ? await readOptionalGearJsonWithPointer(deps, latestPointer, perkWeaponsBucketPath(perkHash))
    : { value: null };
  const cached = packed.value?.perks?.[String(perkHash)]
    ? {
        ...packed,
        value: packed.value.perks[String(perkHash)]
      }
    : await readOptionalGearJsonWithPointer(deps, latestPointer, perkWeaponsPath(perkHash));
  return {
    value: cached.value || null,
    status: cached.status,
    cachedAt: cached.cachedAt,
    ttlSeconds: cached.ttlSeconds
  };
}

export async function getRollRecommendationsIndex(deps, hash) {
  const latestPointer = await getLatestPointer(deps);
  if (!isPackedPointer(latestPointer)) {
    return { value: null, status: 'miss-memory', cachedAt: new Date().toISOString(), ttlSeconds: deps.cacheTtlSeconds || 604800 };
  }
  const packed = await readOptionalGearJsonWithPointer(deps, latestPointer, rollRecommendationsBucketPath(hash));
  return {
    value: packed.value?.items?.[String(hash)] || null,
    status: packed.status,
    cachedAt: packed.cachedAt,
    ttlSeconds: packed.ttlSeconds
  };
}

export async function getSourceAliasesIndex(deps) {
  return readOptionalGearJson(deps, sourceAliasesPath());
}

export async function getSourceIndex(deps, sourceKey) {
  return readOptionalGearJson(deps, sourceIndexPath(sourceKey));
}

export async function readOptionalGearJson(deps, relativePath) {
  const latestPointer = await getLatestPointer(deps);
  return readOptionalGearJsonWithPointer(deps, latestPointer, relativePath);
}

async function readRequiredGearJson(deps, relativePath) {
  const latestPointer = await getLatestPointer(deps);
  return readRequiredGearJsonWithPointer(deps, latestPointer, relativePath);
}

async function readOptionalGearJsonWithPointer(deps, latestPointer, relativePath) {
  const path = joinGearPath(gearRootPath(latestPointer, deps), relativePath);
  const cached = await cachedGearJson(deps, path, async () => deps.readGearJson(path));
  return cached;
}

async function readRequiredGearJsonWithPointer(deps, latestPointer, relativePath) {
  const path = joinGearPath(gearRootPath(latestPointer, deps), relativePath);
  const cached = await cachedGearJson(deps, path, async () => deps.readGearJson(path));
  if (!cached.value) {
    throw httpError(503, 'GEAR_INDEX_NOT_FOUND', GEAR_INDEX_NOT_FOUND_MESSAGE);
  }
  return {
    ...cached.value,
    cacheMeta: cacheMeta(cached)
  };
}

function isPackedPointer(pointer) {
  return Number(pointer?.schemaVersion || 0) >= 3;
}

async function getLatestPointer(deps) {
  if (!deps?.readGearJson || !deps?.getLatestGearPointer) {
    throw httpError(503, 'GEAR_INDEX_NOT_FOUND', GEAR_INDEX_NOT_FOUND_MESSAGE);
  }
  const cached = await cachedGearJson(deps, 'latest.json', () => deps.getLatestGearPointer());
  const latestPointer = cached.value;
  if (!latestPointer?.root || !latestPointer.manifestVersion) {
    throw httpError(503, 'GEAR_INDEX_NOT_FOUND', GEAR_INDEX_NOT_FOUND_MESSAGE);
  }
  return {
    ...latestPointer,
    cacheMeta: cacheMeta(cached)
  };
}

async function cachedGearJson(deps, path, producer) {
  const locale = deps.locale || 'zh-chs';
  const cacheKey = ['gear', GEAR_INDEX_VERSION, locale, path].join(':');
  const ttlSeconds = deps.cacheTtlSeconds || 604800;
  if (typeof deps.getCachedJson === 'function') {
    return deps.getCachedJson(cacheKey, ttlSeconds, producer, { noClone: true, memoryOnly: true });
  }
  const value = await producer();
  return {
    value,
    status: 'miss-memory',
    cachedAt: new Date().toISOString(),
    ttlSeconds
  };
}

function withMeta(deps, files, value) {
  const metas = files.map((file) => file.cacheMeta).filter(Boolean);
  const meta = metas[0] || {
    status: 'miss-memory',
    cachedAt: new Date().toISOString(),
    ttlSeconds: deps.cacheTtlSeconds || 604800
  };
  return {
    value,
    status: meta.status,
    cachedAt: meta.cachedAt,
    ttlSeconds: meta.ttlSeconds
  };
}

function cacheMeta(cached) {
  return {
    status: cached.status,
    cachedAt: cached.cachedAt,
    ttlSeconds: cached.ttlSeconds
  };
}

function firstValue(items, key) {
  return items.find((item) => item?.[key])?.[key] || null;
}

function gearRootPath(latestPointer, deps) {
  const root = String(latestPointer?.root || '');
  if (!root || root.includes('/') || !deps.gearPrefix) return root;
  return joinGearPath(deps.gearPrefix || GEAR_SPLIT_PREFIX, deps.locale || 'zh-chs', root);
}
