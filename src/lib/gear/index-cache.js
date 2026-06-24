import { GEAR_INDEX_VERSION } from './constants.js';
import { buildGearIndex } from './build-index.js';

export async function getGearIndex(deps) {
  const locale = deps.locale || 'zh-chs';
  const cacheKey = ['gear', GEAR_INDEX_VERSION, locale].join(':');
  return deps.getCachedJson(
    cacheKey,
    deps.cacheTtlSeconds || 604800,
    async () => (await loadStaticGearIndex(deps)) || buildGearIndex(deps),
    { persistLarge: true, noClone: true, memoryOnly: true }
  );
}

export async function loadStaticGearIndex(deps) {
  if (deps.disableStaticIndex || typeof deps.loadStaticGearIndex !== 'function') return null;
  const index = await deps.loadStaticGearIndex();
  if (!index?.items || !index?.weapons) return null;
  return index;
}
