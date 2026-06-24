import { cleanText } from '../utils/index.js';
import {
  selectMembership,
  membershipTypeName,
  bungieAssetUrl,
  bungieFetch
} from '../bungie/index.js';
import { httpError, positiveNumber } from '../http/index.js';
import { getWorkerCachedJson } from '../cache/index.js';
import { CACHE_VERSION } from '../shared/index.js';

export async function getDestinyPlayerSearch(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后搜索棒鸡玩家');
  }

  const query = cleanText(body?.query || body?.name || body?.displayName || '');
  const limit = Math.min(Math.max(Number(body?.limit || 30), 1), 40);
  if (!query) {
    return {
      query,
      page: 0,
      hasMore: false,
      items: []
    };
  }

  const cacheKey = [
    'player-search',
    CACHE_VERSION,
    env.BUNGIE_LOCALE || 'zh-chs',
    query.toLocaleLowerCase(),
    limit
  ].join(':');
  const cached = await getWorkerCachedJson(cacheKey, positiveNumber(env.PLAYER_SEARCH_CACHE_TTL_SECONDS, 300), async () => {
    const search = await searchBungiePlayersByPrefix(query, limit, env);
    return {
      query,
      page: 0,
      pagesScanned: search.pagesScanned,
      hasMore: search.hasMore,
      items: search.items
    };
  }, env, ctx, { memoryOnly: true });

  return {
    ...cached.value,
    cache: {
      status: cached.status,
      cachedAt: cached.cachedAt,
      ttlSeconds: cached.ttlSeconds
    }
  };
}

export async function searchBungiePlayersByPrefix(query, limit, env) {
  const maxPages = Math.min(Math.max(Number(env.PLAYER_SEARCH_MAX_PAGES || 4), 1), 10);
  const items = [];
  const seen = new Set();
  let hasMore = false;
  let pagesScanned = 0;

  for (let page = 0; page < maxPages && items.length < limit; page += 1) {
    const search = await bungieFetch(
      `/Platform/User/Search/GlobalName/${page}/`,
      {
        method: 'POST',
        body: JSON.stringify({ displayNamePrefix: query })
      },
      env
    );
    const response = search.Response || {};
    const results = Array.isArray(response.searchResults) ? response.searchResults : [];
    pagesScanned += 1;
    hasMore = Boolean(response.hasMore);

    for (const result of results) {
      const item = normalizePlayerSearchResult(result);
      if (!item) continue;
      const key = `${item.bungieName}:${item.membershipId || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
      if (items.length >= limit) break;
    }

    if (!hasMore) break;
  }

  return {
    items,
    pagesScanned,
    hasMore: hasMore || items.length >= limit
  };
}

export function normalizePlayerSearchResult(item) {
  const memberships = Array.isArray(item?.destinyMemberships) ? item.destinyMemberships : [];
  if (!memberships.length) return null;

  const selected = selectMembership(memberships);
  const displayName = cleanText(item.bungieGlobalDisplayName || selected.bungieGlobalDisplayName || selected.displayName);
  const displayNameCode = Number(item.bungieGlobalDisplayNameCode || selected.bungieGlobalDisplayNameCode || 0);
  if (!displayName || !displayNameCode) return null;

  const bungieName = `${displayName}#${String(displayNameCode).padStart(4, '0')}`;
  return {
    bungieName,
    displayName,
    displayNameCode,
    membershipType: selected.membershipType,
    membershipTypeName: membershipTypeName(selected.membershipType),
    membershipId: selected.membershipId,
    displayMembershipName: selected.displayName || '',
    crossSaveOverride: selected.crossSaveOverride || 0,
    isPublic: selected.isPublic !== false,
    icon: bungieAssetUrl(selected.iconPath),
    linkedAccounts: memberships.map((membership) => ({
      displayName: membership.displayName || '',
      membershipType: membership.membershipType,
      membershipTypeName: membershipTypeName(membership.membershipType),
      membershipId: membership.membershipId,
      crossSaveOverride: membership.crossSaveOverride || 0,
      isPublic: membership.isPublic !== false,
      icon: bungieAssetUrl(membership.iconPath)
    }))
  };
}
