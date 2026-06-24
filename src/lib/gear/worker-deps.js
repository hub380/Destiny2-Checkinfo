import { loadR2GearIndex } from './cache.js';
import { httpError, positiveNumber } from '../http/index.js';
import { getWorkerCachedJson } from '../cache/index.js';

export function workerGearDeps(env, ctx) {
  const locale = env.BUNGIE_LOCALE || 'zh-chs';
  return {
    apiKey: env.BUNGIE_API_KEY,
    locale,
    timeoutMs: positiveNumber(env.GEAR_MANIFEST_TIMEOUT_MS, positiveNumber(env.REQUEST_TIMEOUT_MS, 30000)),
    maxBytes: positiveNumber(env.GEAR_MANIFEST_MAX_BYTES, 80_000_000),
    cacheTtlSeconds: positiveNumber(env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800),
    loadStaticGearIndex: async () => {
      const r2Index = await loadR2GearIndex(env);
      if (r2Index) return r2Index;
      if (!env.ASSETS?.fetch) return null;
      const response = await env.ASSETS.fetch(new Request(`https://assets.local/data/gear-index-${locale}.json`));
      if (response.status === 404) return null;
      if (!response.ok) {
        throw httpError(response.status, 'STATIC_GEAR_INDEX_ERROR', `Static gear index returned HTTP ${response.status}`);
      }
      return response.json();
    },
    getCachedJson: (key, ttlSeconds, producer, options) => getWorkerCachedJson(key, ttlSeconds, producer, env, ctx, options)
  };
}
