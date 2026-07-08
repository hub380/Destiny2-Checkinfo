import { getGearSearchIndex } from './index-cache.js';

/** Preload weapon/armor/perk search shards into memory cache. */
export async function warmGearSearchIndex(deps) {
  await Promise.all(['weapon', 'armor', 'perk'].map((kind) => getGearSearchIndex(deps, kind)));
  return {
    ok: true,
    warmedAt: new Date().toISOString()
  };
}
