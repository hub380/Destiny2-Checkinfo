const LOCAL_MEMORY_CACHE = new Map();

/** Process-local JSON cache for local server gear deps (mirrors worker memoryOnly path). */
export async function getLocalCachedJson(key, ttlSeconds, producer, options = {}) {
  const now = Date.now();
  const cached = LOCAL_MEMORY_CACHE.get(key);
  if (cached && cached.expiresAt > now) {
    return {
      value: options.noClone ? cached.value : structuredClone(cached.value),
      status: 'hit-memory',
      cachedAt: cached.cachedAt,
      ttlSeconds
    };
  }

  const value = await producer();
  const cachedAt = new Date().toISOString();
  LOCAL_MEMORY_CACHE.set(key, {
    value,
    cachedAt,
    expiresAt: now + ttlSeconds * 1000
  });
  return {
    value: options.noClone ? value : structuredClone(value),
    status: 'miss-memory',
    cachedAt,
    ttlSeconds
  };
}
