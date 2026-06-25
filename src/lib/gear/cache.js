const BUNGIE_BASE_URL = 'https://www.bungie.net';
const DEFAULT_LOCALE = 'zh-chs';
const DEFAULT_GEAR_PREFIX = 'gear-cache/v2';
const DEFAULT_BUCKET = 'destiny2-checkinfo-data';

export async function loadR2GearIndex(env = {}) {
  const pointer = await readLatestGearPointer(env);
  const r2Key = pointer?.r2Key;
  if (!r2Key || !env.CAREER_R2?.get) return null;

  const object = await env.CAREER_R2.get(r2Key);
  if (!object) return null;

  const index = await object.json();
  if (!isUsableGearIndex(index)) return null;
  return {
    ...index,
    cacheSource: {
      type: 'r2',
      r2Key,
      publishedAt: pointer.publishedAt || null,
      byteSize: Number(object.size || pointer.byteSize || 0)
    }
  };
}

export async function getGearCacheStatus(env = {}) {
  const locale = gearLocale(env);
  const prefix = gearPrefix(env);
  const pointer = await readLatestGearPointer(env);
  const status = await readGearStatus(env);

  return {
    updatedAt: new Date().toISOString(),
    locale,
    prefix,
    bucket: env.R2_BUCKET || DEFAULT_BUCKET,
    configured: {
      r2: Boolean(env.CAREER_R2?.get),
      kv: Boolean(env.CAREER_CACHE?.get)
    },
    latest: pointer,
    check: status,
    strategy: {
      plan: 'workers-free-safe',
      refreshInterval: 'weekly',
      buildLocation: 'github-actions-or-local-script',
      workerCronRole: 'manifest-version-health-check-only'
    }
  };
}

export async function runGearCacheCheck(env = {}, ctx = {}, meta = {}) {
  const checkedAt = new Date().toISOString();
  const pointer = await readLatestGearPointer(env);
  const manifest = await fetchManifestSummary(env);
  const fresh = Boolean(pointer?.manifestVersion && manifest.version && pointer.manifestVersion === manifest.version);
  const status = {
    checkedAt,
    cron: meta.cron || '',
    scheduledTime: meta.scheduledTime || null,
    locale: gearLocale(env),
    fresh,
    manifest,
    latest: pointer,
    action: fresh ? 'none' : 'publish-new-index-with-gear:publish-r2'
  };
  writeGearStatus(status, env, ctx);
  return status;
}

export async function readLatestGearPointer(env) {
  const locale = gearLocale(env);
  const kvPointer = await readKvJson(latestKvKey(locale), env);
  const legacyKvPointer = isUsablePointer(kvPointer)
    ? {
        ...kvPointer,
        source: 'kv'
      }
    : null;
  if (isUsableV2Pointer(kvPointer)) {
    return {
      ...kvPointer,
      source: 'kv'
    };
  }

  const r2Pointer = await readR2Json(latestR2Key(locale, env), env);
  if (isUsablePointer(r2Pointer)) {
    return {
      ...r2Pointer,
      source: 'r2'
    };
  }

  return legacyKvPointer;
}

async function readGearStatus(env) {
  const locale = gearLocale(env);
  const status = (await readKvJson(statusKvKey(locale), env)) || (await readR2Json(statusR2Key(locale, env), env));
  return status && typeof status === 'object' ? status : null;
}

function writeGearStatus(status, env, ctx) {
  const locale = gearLocale(env);
  const writes = [];
  if (env.CAREER_CACHE?.put) {
    writes.push(
      env.CAREER_CACHE.put(statusKvKey(locale), JSON.stringify(status), {
        expirationTtl: positiveNumber(env.GEAR_CACHE_STATUS_TTL_SECONDS, 604800)
      })
    );
  }
  if (env.CAREER_R2?.put) {
    writes.push(
      env.CAREER_R2.put(statusR2Key(locale, env), JSON.stringify(status), {
        httpMetadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'public, max-age=604800'
        },
        customMetadata: {
          checkedAt: status.checkedAt,
          fresh: String(status.fresh)
        }
      })
    );
  }
  waitFor(Promise.allSettled(writes), ctx);
}

async function fetchManifestSummary(env) {
  if (!env.BUNGIE_API_KEY) {
    return {
      version: null,
      error: 'BUNGIE_API_KEY_MISSING'
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), positiveNumber(env.GEAR_CACHE_CHECK_TIMEOUT_MS, 10000));
  try {
    const response = await fetch(`${BUNGIE_BASE_URL}/Platform/Destiny2/Manifest/?lc=${encodeURIComponent(gearLocale(env))}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'x-api-key': env.BUNGIE_API_KEY,
        'accept-language': gearLocale(env),
        accept: 'application/json'
      }
    });
    const payload = await response.json();
    if (!response.ok || (payload.ErrorCode && payload.ErrorCode !== 1)) {
      return {
        version: null,
        error: payload.Message || `HTTP ${response.status}`
      };
    }
    return {
      version: payload.Response?.version || null,
      mobileAssetContentPath: payload.Response?.mobileAssetContentPath || '',
      jsonWorldComponentContentPaths: Boolean(payload.Response?.jsonWorldComponentContentPaths)
    };
  } catch (error) {
    return {
      version: null,
      error: error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : error.message || 'MANIFEST_CHECK_FAILED'
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readKvJson(key, env) {
  if (!env.CAREER_CACHE?.get) return null;
  try {
    return await env.CAREER_CACHE.get(key, 'json');
  } catch {
    return null;
  }
}

async function readR2Json(key, env) {
  if (!env.CAREER_R2?.get) return null;
  try {
    const object = await env.CAREER_R2.get(key);
    return object ? object.json() : null;
  } catch {
    return null;
  }
}

function isUsablePointer(pointer) {
  return Boolean(pointer && typeof pointer === 'object' && pointer.manifestVersion && (pointer.r2Key || pointer.root));
}

function isUsableV2Pointer(pointer) {
  return Boolean(pointer && typeof pointer === 'object' && pointer.manifestVersion && pointer.root);
}

function isUsableGearIndex(index) {
  return Boolean(index && Array.isArray(index.items) && Array.isArray(index.weapons));
}

function latestKvKey(locale) {
  return `gear-cache:latest:${locale}`;
}

function statusKvKey(locale) {
  return `gear-cache:status:${locale}`;
}

function latestR2Key(locale, env) {
  return `${gearPrefix(env)}/${locale}/latest.json`;
}

function statusR2Key(locale, env) {
  return `${gearPrefix(env)}/${locale}/status.json`;
}

function gearLocale(env) {
  return String(env.BUNGIE_LOCALE || DEFAULT_LOCALE).toLowerCase();
}

function gearPrefix(env) {
  return trimSlashes(env.R2_GEAR_PREFIX || DEFAULT_GEAR_PREFIX);
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function waitFor(task, ctx) {
  const safeTask = Promise.resolve(task).catch(() => undefined);
  if (ctx?.waitUntil) ctx.waitUntil(safeTask);
}
