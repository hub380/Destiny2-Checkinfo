import { GEAR_INDEX_VERSION } from './constants.js';
import { httpError } from './utils.js';
import { gearItemPath, joinGearPath, perkWeaponsPath, searchShardPath, sourceAliasesPath, sourceIndexPath } from './split-paths.js';

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
  const itemFile = await readRequiredGearJson(deps, gearItemPath(hash));
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
  return withMeta(deps, [itemFile], index);
}

export async function getPerkWeaponsIndex(deps, perkHash) {
  const index = await readRequiredGearJson(deps, perkWeaponsPath(perkHash));
  return withMeta(deps, [index], index);
}

export async function getOptionalPerkWeaponsIndex(deps, perkHash) {
  const cached = await readOptionalGearJson(deps, perkWeaponsPath(perkHash));
  return {
    value: cached.value || null,
    status: cached.status,
    cachedAt: cached.cachedAt,
    ttlSeconds: cached.ttlSeconds
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
  const path = joinGearPath(latestPointer.root, relativePath);
  return cachedGearJson(deps, path, async () => deps.readGearJson(path));
}

async function readRequiredGearJson(deps, relativePath) {
  const latestPointer = await getLatestPointer(deps);
  const path = joinGearPath(latestPointer.root, relativePath);
  const cached = await cachedGearJson(deps, path, async () => deps.readGearJson(path));
  if (!cached.value) {
    throw httpError(503, 'GEAR_INDEX_NOT_FOUND', GEAR_INDEX_NOT_FOUND_MESSAGE);
  }
  return {
    ...cached.value,
    cacheMeta: cacheMeta(cached)
  };
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
