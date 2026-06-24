import { cleanText, parseBungieName } from '../utils/index.js';
import {
  selectMembership,
  displayMembershipName,
  membershipTypeName,
  bungieAssetUrl,
  className,
  raceName,
  genderName,
  percentStat,
  bungieFetch
} from '../bungie/index.js';
import { httpError, positiveNumber } from '../http/index.js';
import { getWorkerCachedJson, summaryCacheTtlSeconds } from '../cache/index.js';
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

export async function getPublicCareerSummaryByMembership(membership, env, ctx) {
  const membershipId = cleanText(membership?.membershipId);
  const preferredType = cleanText(membership?.membershipType || '');
  if (!membershipId) throw httpError(400, 'INVALID_MEMBERSHIP_ID', '缂哄皯 Destiny membershipId');

  const cacheKey = [
    'summary-membership',
    CACHE_VERSION,
    env.BUNGIE_LOCALE || 'zh-chs',
    preferredType || 'any',
    membershipId
  ].join(':');
  const cached = await getWorkerCachedJson(cacheKey, summaryCacheTtlSeconds(env), async () => {
    const profileResult = await fetchPublicProfileByMembership(membershipId, preferredType, env);
    let statsResponse = {};
    try {
      const stats = await bungieFetch(
        `/Platform/Destiny2/${profileResult.membershipType}/Account/${membershipId}/Stats/`,
        { method: 'GET' },
        env
      );
      statsResponse = stats.Response || {};
    } catch {
      statsResponse = {};
    }
    const userInfo = profileResult.profileResponse.profile?.data?.userInfo || {};
    const resolvedMembership = {
      ...membership,
      ...userInfo,
      membershipType: profileResult.membershipType,
      membershipId
    };
    const parsedName = parsedNameFromMembership(resolvedMembership);
    const summary = summarizeCareer(parsedName, resolvedMembership, [resolvedMembership], profileResult.profileResponse, statsResponse);
    summary.queriedName = parsedName.displayNameCode
      ? `${parsedName.displayName}#${String(parsedName.displayNameCode).padStart(4, '0')}`
      : displayMembershipName(resolvedMembership);
    return summary;
  }, env, ctx);

  return {
    ...cached.value,
    cache: {
      ...(cached.value.cache || {}),
      summary: cached.status,
      summaryCachedAt: cached.cachedAt,
      summaryTtlSeconds: cached.ttlSeconds
    }
  };
}

export async function fetchPublicProfileByMembership(membershipId, preferredType, env) {
  const candidates = Array.from(new Set([preferredType, 3, 2, 1, 6, 4].filter((item) => item !== '' && item != null).map(String)));
  let lastError = null;
  for (const membershipType of candidates) {
    try {
      const payload = await bungieFetch(
        `/Platform/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200`,
        { method: 'GET' },
        env
      );
      if (payload.Response?.profile?.data) {
        return {
          membershipType,
          profileResponse: payload.Response || {}
        };
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || httpError(404, 'PLAYER_PROFILE_NOT_FOUND', '娌℃湁鎵惧埌璇ラ槦浼嶆垚鍛樼殑鍏紑璧勬枡');
}

export function parsedNameFromMembership(membership) {
  const displayName = cleanText(membership.bungieGlobalDisplayName || membership.displayName || membership.membershipId || 'Guardian');
  const displayNameCode = Number(membership.bungieGlobalDisplayNameCode || membership.displayNameCode || 0);
  return {
    displayName,
    displayNameCode
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

export async function getDestinySummary(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const parsedName = parseBungieName(body?.bungieName || body?.name || '');
  if (!parsedName) {
    throw httpError(400, 'INVALID_BUNGIE_NAME', '璇疯緭鍏ユ楦″悕绉帮紝鏍煎紡涓?鍚嶇О#鏁板瓧浠ｇ爜');
  }

  const membershipType = env.BUNGIE_MEMBERSHIP_TYPE || '-1';
  const cacheKey = [
    'summary',
    CACHE_VERSION,
    env.BUNGIE_LOCALE || 'zh-chs',
    membershipType,
    parsedName.displayName.toLocaleLowerCase(),
    parsedName.displayNameCode
  ].join(':');
  const cached = await getWorkerCachedJson(cacheKey, summaryCacheTtlSeconds(env), async () => {
    const search = await bungieFetch(
      `/Platform/Destiny2/SearchDestinyPlayerByBungieName/${membershipType}/`,
      {
        method: 'POST',
        body: JSON.stringify(parsedName)
      },
      env
    );

    const memberships = Array.isArray(search.Response) ? search.Response : [];
    if (!memberships.length) {
      throw httpError(404, 'PLAYER_NOT_FOUND', '娌℃湁鎵惧埌杩欎釜妫掗浮鐜╁');
    }

    const selected = selectMembership(memberships);
    const [profile, stats] = await Promise.all([
      bungieFetch(
        `/Platform/Destiny2/${selected.membershipType}/Profile/${selected.membershipId}/?components=100,200`,
        { method: 'GET' },
        env
      ),
      bungieFetch(
        `/Platform/Destiny2/${selected.membershipType}/Account/${selected.membershipId}/Stats/`,
        { method: 'GET' },
        env
      )
    ]);

    return summarizeCareer(parsedName, selected, memberships, profile.Response || {}, stats.Response || {});
  }, env, ctx);

  const career = cached.value;
  career.cache = {
    ...(career.cache || {}),
    summary: cached.status,
    summaryCachedAt: cached.cachedAt,
    summaryTtlSeconds: cached.ttlSeconds
  };
  return career;
}

export function summarizeCareer(query, membership, memberships, profileResponse, statsResponse) {
  const profile = profileResponse.profile?.data || {};
  const characters = Object.values(profileResponse.characters?.data || {}).map((character) => ({
    id: character.characterId,
    className: className(character.classType),
    raceName: raceName(character.raceType),
    genderName: genderName(character.genderType),
    light: character.light,
    level: character.levelProgression?.level,
    emblemPath: character.emblemPath ? `https://www.bungie.net${character.emblemPath}` : '',
    minutesPlayedTotal: Number(character.minutesPlayedTotal || 0),
    dateLastPlayed: character.dateLastPlayed
  }));

  const merged = statsResponse.mergedAllCharacters?.results || {};
  const overall = merged.merged?.allTime || {};
  const pve = merged.allPvE?.allTime || {};
  const pvp = merged.allPvP?.allTime || {};
  const raid = findModeBucket(merged, ['raid', 'allRaid']);
  const dungeon = findModeBucket(merged, ['dungeon', 'allDungeon']);

  return {
    queriedName: `${query.displayName}#${query.displayNameCode}`,
    updatedAt: new Date().toISOString(),
    account: {
      displayName: displayMembershipName(membership),
      membershipType: membership.membershipType,
      membershipTypeName: membershipTypeName(membership.membershipType),
      membershipId: membership.membershipId,
      crossSaveOverride: membership.crossSaveOverride || 0,
      linkedAccounts: memberships.map((item) => ({
        displayName: displayMembershipName(item),
        membershipType: item.membershipType,
        membershipTypeName: membershipTypeName(item.membershipType),
        membershipId: item.membershipId,
        crossSaveOverride: item.crossSaveOverride || 0
      }))
    },
    profile: {
      dateLastPlayed: profile.dateLastPlayed || null,
      guardianRank: profile.currentGuardianRank || null,
      lifetimeHighestGuardianRank: profile.lifetimeHighestGuardianRank || null,
      characterCount: characters.length,
      maxLight: characters.reduce((max, character) => Math.max(max, Number(character.light || 0)), 0),
      totalMinutesPlayed: characters.reduce((sum, character) => sum + Number(character.minutesPlayedTotal || 0), 0)
    },
    characters,
    stats: {
      overall: pickStats(overall),
      pve: pickStats(pve),
      pvp: pickStats(pvp),
      raid: pickEndgameStats(raid),
      dungeon: pickEndgameStats(dungeon)
    }
  };
}


export function findModeBucket(results, names) {
  for (const name of names) {
    if (results?.[name]?.allTime) return results[name].allTime;
  }

  const normalizedNames = new Set(names.map((name) => normalizeStatModeKey(name)));
  for (const [key, value] of Object.entries(results || {})) {
    if (normalizedNames.has(normalizeStatModeKey(key)) && value?.allTime) {
      return value.allTime;
    }
  }
  return {};
}

export function normalizeStatModeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function pickEndgameStats(bucket) {
  const base = pickStats(bucket);
  const clears = base.activitiesCleared || base.activitiesWon;
  return {
    ...base,
    clears,
    completionRate: percentStat(clears, base.activitiesEntered)
  };
}

export function pickStats(bucket) {
  return {
    activitiesEntered: stat(bucket, 'activitiesEntered'),
    activitiesCleared: stat(bucket, 'activitiesCleared'),
    activitiesWon: stat(bucket, 'activitiesWon'),
    kills: stat(bucket, 'kills'),
    deaths: stat(bucket, 'deaths'),
    assists: stat(bucket, 'assists'),
    kd: stat(bucket, 'killsDeathsRatio'),
    kda: stat(bucket, 'killsDeathsAssists'),
    efficiency: stat(bucket, 'efficiency'),
    precisionKills: stat(bucket, 'precisionKills'),
    resurrectionsPerformed: stat(bucket, 'resurrectionsPerformed'),
    secondsPlayed: stat(bucket, 'secondsPlayed') || stat(bucket, 'totalActivityDurationSeconds')
  };
}

export function decimalStat(value, digits = 2) {
  const number = Number(value || 0);
  return {
    value: number,
    displayValue: new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(number)
  };
}

export function ratioStat(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (bottom <= 0) return top > 0 ? decimalStat(top, 2) : null;
  return decimalStat(top / bottom, 2);
}

export function secondsDisplayStat(seconds) {
  const value = Number(seconds || 0);
  if (!value) return { value: 0, displayValue: '-' };
  const hours = value / 3600;
  if (hours >= 1) return { value, displayValue: `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(hours)} 小时` };
  const minutes = Math.round(value / 60);
  return { value, displayValue: `${minutes} 分钟` };
}

export function stat(bucket, key) {
  const entry = bucket?.[key];
  if (!entry?.basic) return null;
  return {
    value: entry.basic.value,
    displayValue: entry.basic.displayValue
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