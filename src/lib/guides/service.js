import { getGuideDetail, getGuidesIndex } from './core.js';
import { getGuideMediaObject } from '../storage/index.js';
import { httpError, corsHeaders } from '../http/index.js';
import { getWorkerCachedJson, guideIndexCacheTtlSeconds } from '../cache/index.js';
import { CACHE_VERSION } from '../shared/index.js';

export async function getGuides(env, ctx) {
  const cacheKey = ['guides-index', CACHE_VERSION, env.R2_GUIDE_PREFIX || 'guides'].join(':');
  const cached = await getWorkerCachedJson(
    cacheKey,
    guideIndexCacheTtlSeconds(env),
    () => getGuidesIndex(env),
    env,
    ctx,
    { memoryOnly: true }
  );
  return {
    ...cached.value,
    updatedAt: cached.value.updatedAt || cached.cachedAt || new Date().toISOString(),
    cache: {
      ...(cached.value.cache || {}),
      memory: cached.status,
      ttlSeconds: cached.ttlSeconds,
      cachedAt: cached.cachedAt
    }
  };
}

export async function getGuide(slug, env, ctx) {
  const cacheKey = ['guide-detail', CACHE_VERSION, env.R2_GUIDE_PREFIX || 'guides', slug].join(':');
  const cached = await getWorkerCachedJson(
    cacheKey,
    guideIndexCacheTtlSeconds(env),
    () => getGuideDetail(slug, env),
    env,
    ctx,
    { memoryOnly: true }
  );
  return {
    ...cached.value,
    cache: {
      ...(cached.value.cache || {}),
      memory: cached.status,
      ttlSeconds: cached.ttlSeconds,
      cachedAt: cached.cachedAt
    }
  };
}

export async function getGuideMedia(match, env) {
  const slug = safeGuideSlug(decodeURIComponent(match[1] || ''));
  const filename = safeGuideMediaPath(decodeURIComponent(match[2] || ''));
  const media = await getGuideMediaObject(slug, filename, env);
  if (!media?.object?.body) {
    throw httpError(404, 'GUIDE_MEDIA_NOT_FOUND', '没有找到这份攻略媒体资源');
  }
  const headers = {
    ...corsHeaders(),
    'content-type': media.object.httpMetadata?.contentType || mediaContentType(filename),
    'cache-control': 'public, max-age=31536000, immutable'
  };
  if (media.object.httpEtag) headers.etag = media.object.httpEtag;
  return new Response(media.object.body, { headers });
}

function safeGuideMediaPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw httpError(400, 'INVALID_GUIDE_MEDIA_PATH', '攻略媒体路径不正确');
  }
  return normalized;
}

function safeGuideSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug)) {
    throw httpError(400, 'INVALID_GUIDE_SLUG', '攻略 slug 格式不正确');
  }
  return slug;
}

function mediaContentType(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}
