import { runGearCacheCheck } from '#lib/gear/index.js';
import { json } from '#lib/http/index.js';
import { corsPreflightResponse, dispatchApiRequest } from './router.js';

export async function handleAppRequest(request, env = {}, ctx = {}, options = {}) {
  try {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsPreflightResponse();
    }

    const response = await dispatchApiRequest({ request, url, env, ctx, options });
    if (response) return response;

    if (options.assetsFetch) return options.assetsFetch(request);
    if (env.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  } catch (error) {
    return json(
      {
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Unexpected worker error'
        }
      },
      error.status || 500
    );
  }
}

export async function handleScheduled(controller, env = {}, ctx = {}) {
  const task = runGearCacheCheck(env, ctx, {
    cron: controller?.cron || '',
    scheduledTime: controller?.scheduledTime || null
  }).catch((error) => ({
    checkedAt: new Date().toISOString(),
    ok: false,
    error: {
      code: error.code || 'GEAR_CACHE_CHECK_FAILED',
      message: error.message || 'Gear cache check failed'
    }
  }));
  if (ctx?.waitUntil) ctx.waitUntil(task);
  return task;
}
