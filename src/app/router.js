import { getGearItem, getGearSearch, getPerkWeapons, getGearCacheStatus, workerGearDeps } from '#lib/gear/index.js';
import { json, corsHeaders, readJsonBody } from '#lib/http/index.js';
import { getHeyboxTeams } from '#lib/integrations/index.js';
import { getGuides, getGuide, getGuideMedia } from '#lib/guides/index.js';
import {
  getDestinyCareer,
  getDestinyPlayerSearch,
  getDestinyFireteam,
  getDestinySummary,
  getDestinyEndgame,
  getDestinyDetails
} from '#lib/destiny/index.js';

const routes = [
  {
    match: (url, method) => url.pathname === '/api/health' && method === 'GET',
    handle: async () => json({ ok: true, updatedAt: new Date().toISOString() })
  },
  {
    match: (url, method) => url.pathname === '/api/config-public' && method === 'GET',
    handle: async ({ env }) =>
      json({
        hasBungieApiKey: Boolean(env.BUNGIE_API_KEY),
        hasHeyboxSource: true,
        refreshSeconds: 30
      })
  },
  {
    match: (url, method) => url.pathname === '/api/heybox/teams' && method === 'GET',
    handle: async ({ env }) => json(await getHeyboxTeams(env))
  },
  {
    match: (url, method) => url.pathname === '/api/guides' && method === 'GET',
    handle: async ({ env, ctx }) => json(await getGuides(env, ctx))
  },
  {
    match: (url, method) => /^\/api\/guides\/[^/]+\/media\//.test(url.pathname) && method === 'GET',
    handle: async ({ url, env }) => {
      const match = url.pathname.match(/^\/api\/guides\/([^/]+)\/media\/(.+)$/);
      return getGuideMedia(match, env);
    }
  },
  {
    match: (url, method) => url.pathname.startsWith('/api/guides/') && method === 'GET',
    handle: async ({ url, env, ctx }) => {
      const slug = decodeURIComponent(url.pathname.slice('/api/guides/'.length));
      return json(await getGuide(slug, env, ctx));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/gear/search' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getGearSearch(body, workerGearDeps(env, ctx)));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/gear/item' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getGearItem(body, workerGearDeps(env, ctx)));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/gear/perk-weapons' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getPerkWeapons(body, workerGearDeps(env, ctx)));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/gear/cache-status' && method === 'GET',
    handle: async ({ env }) => json(await getGearCacheStatus(env))
  },
  {
    match: (url, method) => url.pathname === '/api/destiny/summary' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getDestinySummary(body, env, ctx));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/destiny/player-search' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getDestinyPlayerSearch(body, env, ctx));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/destiny/fireteam' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getDestinyFireteam(body, env, ctx));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/destiny/endgame' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getDestinyEndgame(body, env, ctx));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/destiny/details' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getDestinyDetails(body, env, ctx));
    }
  },
  {
    match: (url, method) => url.pathname === '/api/destiny/career' && method === 'POST',
    handle: async ({ request, env, ctx }) => {
      const body = await readJsonBody(request);
      return json(await getDestinyCareer(body, env, ctx));
    }
  }
];

export async function dispatchApiRequest(context) {
  const { request, url } = context;
  const route = routes.find((entry) => entry.match(url, request.method));
  if (!route) return null;
  return route.handle(context);
}

export function corsPreflightResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
