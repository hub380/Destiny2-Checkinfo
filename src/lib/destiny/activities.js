import { cleanText, mapWithConcurrency } from '../utils/index.js';
import { bungieFetch } from '../bungie/index.js';
import { httpError } from '../http/index.js';
import {
  getWorkerCachedJson,
  putWorkerCachedJson,
  waitForCacheWrite,
  activityDefinitionCacheTtlSeconds,
  activityDefinitionConcurrency
} from '../cache/index.js';
import { CACHE_VERSION } from '../shared/index.js';
import { activityDefinitionCache, activityIndexCache } from './state.js';
export function isValidActivityDefinition(definition) {
  if (!definition) return false;
  const name = cleanText(definition.name);
  if (!name || /^活动\s+\d+$/u.test(name) || /^Activity\s+\d+$/iu.test(name)) return false;
  return true;
}

export async function getActivityDefinitions(hashes, warnings, env, ctx) {
  const uniqueHashes = Array.from(new Set(hashes.filter(Boolean)));
  const entries = await mapWithConcurrency(
    uniqueHashes,
    activityDefinitionConcurrency(env),
    async (hash) => {
      if (activityDefinitionCache.has(hash)) return [hash, activityDefinitionCache.get(hash)];
      try {
        const mapped = await resolveActivityDefinition(hash, env, ctx);
        activityDefinitionCache.set(hash, mapped);
        return [hash, mapped];
      } catch (error) {
        warnings.push(`activity:${hash}:${error.code || error.message}`);
        return [hash, fallbackActivityDefinition(hash)];
      }
    }
  );
  return new Map(entries);
}

export async function getCachedActivityDefinition(hash, env, ctx) {
  const cacheKey = ['activity-definition', CACHE_VERSION, env.BUNGIE_LOCALE || 'zh-chs', hash].join(':');
  const ttlSeconds = activityDefinitionCacheTtlSeconds(env);
  const cached = await getWorkerCachedJson(cacheKey, ttlSeconds, () => fetchLiveActivityDefinition(hash, env), env, ctx);
  if (!isValidActivityDefinition(cached.value)) {
    const value = await fetchLiveActivityDefinition(hash, env);
    putWorkerCachedJson(cacheKey, value, ttlSeconds, env, ctx);
    return value;
  }
  return cached.value;
}

export async function fetchLiveActivityDefinition(hash, env) {
  const payload = await bungieFetch(
    `/Platform/Destiny2/Manifest/DestinyActivityDefinition/${hash}/?lc=${encodeURIComponent(env.BUNGIE_LOCALE || 'zh-chs')}`,
    { method: 'GET' },
    env
  );
  const definition = payload.Response || {};
  const mapped = {
    hash: String(hash),
    name: cleanText(definition.displayProperties?.name) || `活动 ${hash}`,
    description: cleanText(definition.displayProperties?.description),
    image: definition.pgcrImage ? `https://www.bungie.net${definition.pgcrImage}` : '',
    activityTypeHash: definition.activityTypeHash || null,
    modeTypes: Array.isArray(definition.modeTypes) ? definition.modeTypes : [],
    directorActivityHash: definition.directorActivityHash || null,
    placeHash: definition.placeHash || null,
    destinationHash: definition.destinationHash || null,
    source: 'live'
  };
  if (!isValidActivityDefinition(mapped)) {
    throw httpError(502, 'ACTIVITY_DEFINITION_EMPTY', `Activity definition ${hash} did not contain a usable name`);
  }
  return mapped;
}

export async function resolveActivityDefinition(hash, env, ctx) {
  const staticDefinition = await getStaticActivityDefinition(hash, env, ctx);
  if (isValidActivityDefinition(staticDefinition)) return staticDefinition;
  return getCachedActivityDefinition(hash, env, ctx);
}

export async function getStaticActivityDefinition(hash, env, ctx) {
  const index = await loadStaticActivityIndex(env, ctx);
  const definition = index?.activities?.[String(hash)];
  if (!definition) return null;
  return {
    ...definition,
    hash: String(definition.hash || hash),
    source: 'static'
  };
}

export async function loadStaticActivityIndex(env, ctx) {
  const locale = env.BUNGIE_LOCALE || 'zh-chs';
  if (activityIndexCache.has(locale)) return activityIndexCache.get(locale);
  if (!env.ASSETS?.fetch) return null;

  const load = Promise.resolve()
    .then(async () => {
      const response = await env.ASSETS.fetch(new Request(`https://assets.local/data/activity-index-${locale}.json`));
      if (response.status === 404) return null;
      if (!response.ok) {
        throw httpError(response.status, 'STATIC_ACTIVITY_INDEX_ERROR', `Static activity index returned HTTP ${response.status}`);
      }
      return response.json();
    })
    .catch(() => null);
  waitForCacheWrite(load, ctx);
  const index = await load;
  activityIndexCache.set(locale, index);
  return index;
}

export function fallbackActivityDefinition(hash) {
  return {
    hash: String(hash),
    name: `活动 ${hash}`,
    description: '',
    image: '',
    activityTypeHash: null,
    modeTypes: [],
    directorActivityHash: null,
    placeHash: null,
    destinationHash: null,
    source: 'fallback'
  };
}
