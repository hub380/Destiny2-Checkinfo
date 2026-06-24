import { getCachedR2Json, writeCachedR2Json } from '../storage/index.js';
import { cloneJson } from '../http/index.js';

const WORKER_MEMORY_CACHE = new Map();

export async function getWorkerCachedJson(key, ttlSeconds, producer, env, ctx, options = {}) {
  const now = Date.now();
  const memory = getMemoryCache(key, now, options);
  if (memory) {
    return { ...memory, ttlSeconds };
  }

  if (options.memoryOnly) {
    const value = await producer();
    const cachedAt = new Date().toISOString();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    setMemoryCache(key, value, cachedAt, expiresAt, options);
    return {
      value: options.noClone ? value : cloneJson(value),
      status: 'miss-memory',
      cachedAt,
      ttlSeconds
    };
  }

  const edge = await getEdgeCache(key, now);
  if (edge) {
    setMemoryCache(key, edge.value, edge.cachedAt, edge.expiresAt, options);
    return { ...edge, ttlSeconds };
  }

  const kv = await getKvCache(key, now, env);
  if (kv) {
    setMemoryCache(key, kv.value, kv.cachedAt, kv.expiresAt, options);
    writeEdgeCache(key, kv.value, kv.cachedAt, kv.expiresAt, ttlSeconds, ctx);
    return { ...kv, ttlSeconds };
  }

  if (options.persistLarge) {
    const r2 = await getCachedR2Json(key, now, env);
    if (r2) {
      setMemoryCache(key, r2.value, r2.cachedAt, r2.expiresAt, options);
      writeEdgeCache(key, r2.value, r2.cachedAt, r2.expiresAt, ttlSeconds, ctx);
      writeKvCache(key, r2.value, r2.cachedAt, r2.expiresAt, ttlSeconds, env, ctx);
      return { ...r2, ttlSeconds };
    }
  }

  const value = await producer();
  const cachedAt = new Date().toISOString();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  setMemoryCache(key, value, cachedAt, expiresAt, options);
  writeEdgeCache(key, value, cachedAt, expiresAt, ttlSeconds, ctx);
  writeKvCache(key, value, cachedAt, expiresAt, ttlSeconds, env, ctx);
  let r2Meta = {};
  if (options.persistLarge) {
    r2Meta = writeCachedR2Json(key, value, cachedAt, expiresAt, ttlSeconds, env, ctx) || {};
  }
  return {
    value: options.noClone ? value : cloneJson(value),
    status: 'miss',
    cachedAt,
    ttlSeconds,
    ...r2Meta
  };
}

function getMemoryCache(key, now, options = {}) {
  const cached = WORKER_MEMORY_CACHE.get(key);
  if (!cached || cached.expiresAt <= now) return null;
  return {
    value: options.noClone ? cached.value : cloneJson(cached.value),
    status: 'hit-memory',
    cachedAt: cached.cachedAt,
    expiresAt: cached.expiresAt
  };
}

function setMemoryCache(key, value, cachedAt, expiresAt, options = {}) {
  WORKER_MEMORY_CACHE.set(key, {
    value: options.noClone ? value : cloneJson(value),
    cachedAt,
    expiresAt
  });
}

async function getEdgeCache(key, now) {
  if (typeof caches === 'undefined' || !caches.default) return null;
  const response = await caches.default.match(cacheRequest(key));
  if (!response) return null;
  const entry = await response.json();
  if (!entry || entry.expiresAt <= now) return null;
  return {
    value: entry.value,
    status: 'hit-edge',
    cachedAt: entry.cachedAt,
    expiresAt: entry.expiresAt
  };
}

function writeEdgeCache(key, value, cachedAt, expiresAt, ttlSeconds, ctx) {
  if (typeof caches === 'undefined' || !caches.default) return;
  const write = Promise.resolve().then(() =>
    caches.default.put(
      cacheRequest(key),
      new Response(JSON.stringify({ value, cachedAt, expiresAt }), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': `public, max-age=${ttlSeconds}`
        }
      })
    )
  );
  waitForCacheWrite(write, ctx);
}

async function getKvCache(key, now, env) {
  const kv = env.CAREER_CACHE;
  if (!kv?.get) return null;
  const entry = await kv.get(key, 'json');
  if (!entry || entry.expiresAt <= now) return null;
  return {
    value: entry.value,
    status: 'hit-kv',
    cachedAt: entry.cachedAt,
    expiresAt: entry.expiresAt
  };
}

function writeKvCache(key, value, cachedAt, expiresAt, ttlSeconds, env, ctx) {
  const kv = env.CAREER_CACHE;
  if (!kv?.put) return;
  const write = Promise.resolve().then(() =>
    kv.put(key, JSON.stringify({ value, cachedAt, expiresAt }), {
      expirationTtl: Math.max(60, ttlSeconds)
    })
  );
  waitForCacheWrite(write, ctx);
}

function cacheRequest(key) {
  return new Request(`https://destiny2-fireteam-dashboard.local/cache/${encodeURIComponent(key)}`, { method: 'GET' });
}

export function waitForCacheWrite(write, ctx) {
  const safeWrite = Promise.resolve(write).catch(() => undefined);
  if (ctx?.waitUntil) {
    ctx.waitUntil(safeWrite);
  }
}

export function putWorkerCachedJson(key, value, ttlSeconds, env, ctx, options = {}) {
  const cachedAt = new Date().toISOString();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  setMemoryCache(key, value, cachedAt, expiresAt, options);
  writeEdgeCache(key, value, cachedAt, expiresAt, ttlSeconds, ctx);
  writeKvCache(key, value, cachedAt, expiresAt, ttlSeconds, env, ctx);
}
