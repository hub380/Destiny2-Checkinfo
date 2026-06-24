const DEFAULT_SNAPSHOT_PREFIX = 'career-snapshots';
const DEFAULT_GUIDE_PREFIX = 'guides';

export function hasR2(env) {
  return Boolean(env?.CAREER_R2?.get);
}

export async function getCachedR2Json(cacheKey, now, env) {
  const r2 = env?.CAREER_R2;
  if (!r2?.get) return null;
  const r2Key = snapshotObjectKey(cacheKey, env);
  const object = await r2.get(r2Key);
  if (!object) return null;
  const entry = await object.json();
  if (!entry || entry.expiresAt <= now) return null;
  return {
    value: entry.value,
    status: 'hit-r2',
    cachedAt: entry.cachedAt,
    expiresAt: entry.expiresAt,
    r2Key,
    byteSize: Number(object.size || entry.byteSize || 0)
  };
}

export function writeCachedR2Json(cacheKey, value, cachedAt, expiresAt, ttlSeconds, env, ctx) {
  const r2 = env?.CAREER_R2;
  if (!r2?.put) return;
  const r2Key = snapshotObjectKey(cacheKey, env);
  const body = JSON.stringify({ value, cachedAt, expiresAt });
  const byteSize = byteLength(body);
  const write = Promise.resolve().then(() =>
    r2.put(r2Key, body, {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: `public, max-age=${ttlSeconds}`
      },
      customMetadata: {
        cachedAt,
        expiresAt: String(expiresAt),
        byteSize: String(byteSize)
      }
    })
  );
  waitFor(write, ctx);
  return { r2Key, byteSize };
}

export async function getGuideIndexObject(env) {
  return getR2JsonObject(guideObjectKey('index.json', env), env);
}

export async function getGuideDetailObject(slug, env) {
  return getR2JsonObject(guideObjectKey(`${slug}/guide.json`, env), env);
}

export async function getGuideMediaObject(slug, filename, env) {
  const r2 = env?.CAREER_R2;
  if (!r2?.get) return null;
  const r2Key = guideMediaObjectKey(slug, filename, env);
  const object = await r2.get(r2Key);
  if (!object) return null;
  return {
    object,
    r2Key,
    byteSize: Number(object.size || 0),
    uploadedAt: object.uploaded?.toISOString?.() || null
  };
}

export function guideMediaObjectKey(slug, filename, env) {
  return guideObjectKey(`${slug}/media/${filename}`, env);
}

async function getR2JsonObject(r2Key, env) {
  const r2 = env?.CAREER_R2;
  if (!r2?.get) return null;
  const object = await r2.get(r2Key);
  if (!object) return null;
  return {
    value: await object.json(),
    status: 'hit-r2',
    r2Key,
    byteSize: Number(object.size || 0),
    uploadedAt: object.uploaded?.toISOString?.() || null
  };
}

function snapshotObjectKey(cacheKey, env) {
  return `${prefix(env?.R2_SNAPSHOT_PREFIX, DEFAULT_SNAPSHOT_PREFIX)}/${encodeURIComponent(cacheKey)}.json`;
}

function guideObjectKey(pathname, env) {
  return `${prefix(env?.R2_GUIDE_PREFIX, DEFAULT_GUIDE_PREFIX)}/${trimSlashes(pathname)}`;
}

function prefix(value, fallback) {
  return trimSlashes(String(value || fallback || ''));
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function waitFor(write, ctx) {
  const safeWrite = Promise.resolve(write).catch(() => undefined);
  if (ctx?.waitUntil) ctx.waitUntil(safeWrite);
}
