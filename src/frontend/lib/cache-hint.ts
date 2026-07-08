import { relativeTime } from './format';

const CACHE_HIT_STATUSES = new Set(['hit', 'hit-memory', 'hit-kv', 'hit-r2', 'hit-edge', 'hit-d1']);

function isCacheHit(value: unknown) {
  return typeof value === 'string' && CACHE_HIT_STATUSES.has(value);
}

/** Human-readable cache hint for API payloads with cache metadata. */
export function formatCacheHint(cache?: Record<string, unknown> | null): string {
  if (!cache || typeof cache !== 'object') return '';

  const fields = [
    cache.summary,
    cache.playerName,
    cache.endgame,
    cache.endgameHitLevel,
    cache.hitLevel,
    cache.gearIndex,
    cache.perkWeapons,
    cache.details
  ];
  const hitField = fields.find(isCacheHit);
  if (!hitField) return '';

  const cachedAt = String(
    cache.summaryCachedAt || cache.endgameCachedAt || cache.gearIndexCachedAt || cache.perkWeaponsCachedAt || ''
  );
  if (cachedAt) return `数据来自缓存 · ${relativeTime(cachedAt)}`;
  return '数据来自缓存';
}

export function mergeCacheHints(...values: Array<string | undefined | null>) {
  return values.filter(Boolean).join(' · ');
}
