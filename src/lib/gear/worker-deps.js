import { readLatestGearPointer } from './cache.js';
import { GEAR_SPLIT_PREFIX } from './split-paths.js';
import { positiveNumber } from '../http/index.js';
import { getWorkerCachedJson } from '../cache/index.js';

export function workerGearDeps(env, ctx) {
  if (env.GEAR_DEPS && typeof env.GEAR_DEPS === 'object') return env.GEAR_DEPS;
  const locale = env.BUNGIE_LOCALE || 'zh-chs';
  return {
    apiKey: env.BUNGIE_API_KEY,
    locale,
    gearPrefix: env.R2_GEAR_PREFIX || GEAR_SPLIT_PREFIX,
    timeoutMs: positiveNumber(env.GEAR_MANIFEST_TIMEOUT_MS, positiveNumber(env.REQUEST_TIMEOUT_MS, 30000)),
    maxBytes: positiveNumber(env.GEAR_MANIFEST_MAX_BYTES, 80_000_000),
    cacheTtlSeconds: positiveNumber(env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800),
    getLatestGearPointer: () => readLatestGearPointer(env),
    readGearJson: async (key) => {
      if (!env.CAREER_R2?.get) return null;
      const object = await env.CAREER_R2.get(key);
      return object ? object.json() : null;
    },
    getCachedJson: (key, ttlSeconds, producer, options) => getWorkerCachedJson(key, ttlSeconds, producer, env, ctx, options)
  };
}
