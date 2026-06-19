import { getGearItem, getGearSearch, getPerkWeapons } from './gear-core.js';
import { getGuideDetail, getGuidesIndex } from './guides-core.js';
import { getCachedR2Json, getGuideMediaObject, writeCachedR2Json } from './r2-store.js';

const DEFAULT_HEYBOX_SOURCE_URL = 'https://api.xiaoheihe.cn/game/common_team_v2/home?appid=1085660';
const ACTIVITY_INDEX_CACHE = new Map();
const ACTIVITY_DEFINITION_CACHE = new Map();
const ITEM_DEFINITION_CACHE = new Map();
const WORKER_MEMORY_CACHE = new Map();
const CACHE_VERSION = '2026-06-15-react-cache-v1';
const SAMPLE_FIRETEAMS = [
  {
    id: 'demo-1',
    source: 'demo',
    title: '宗师日落 需要清怪稳定',
    activity: 'PvE / 宗师',
    content: '缺 1，带反勇士，语音可不开。',
    author: '示例队长',
    username: 'GuardianCN#2333',
    joinCommand: '/j GuardianCN#2333',
    slots: { current: 2, max: 3 },
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    tags: ['演示数据']
  }
];

export async function handleAppRequest(request, env = {}, ctx = {}, options = {}) {
  try {
    const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders()
        });
      }

      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({ ok: true, updatedAt: new Date().toISOString() });
      }

      if (url.pathname === '/api/config-public' && request.method === 'GET') {
        return json({
          hasBungieApiKey: Boolean(env.BUNGIE_API_KEY),
          hasHeyboxSource: true,
          refreshSeconds: 30
        });
      }

      if (url.pathname === '/api/fireteams' && request.method === 'GET') {
        return json(await getFireteams(env));
      }

      if (url.pathname === '/api/guides' && request.method === 'GET') {
        return json(await getGuides(env, ctx));
      }

      const guideMediaMatch = url.pathname.match(/^\/api\/guides\/([^/]+)\/media\/(.+)$/);
      if (guideMediaMatch && request.method === 'GET') {
        return getGuideMedia(guideMediaMatch, env);
      }

      if (url.pathname.startsWith('/api/guides/') && request.method === 'GET') {
        const slug = decodeURIComponent(url.pathname.slice('/api/guides/'.length));
        return json(await getGuide(slug, env, ctx));
      }

      if (url.pathname === '/api/gear/search' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getGearSearch(body, workerGearDeps(env, ctx)));
      }

      if (url.pathname === '/api/gear/item' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getGearItem(body, workerGearDeps(env, ctx)));
      }

      if (url.pathname === '/api/gear/perk-weapons' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getPerkWeapons(body, workerGearDeps(env, ctx)));
      }

      if (url.pathname === '/api/destiny/summary' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getDestinySummary(body, env, ctx));
      }

      if (url.pathname === '/api/destiny/player-search' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getDestinyPlayerSearch(body, env, ctx));
      }

      if (url.pathname === '/api/destiny/fireteam' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getDestinyFireteam(body, env, ctx));
      }

      if (url.pathname === '/api/destiny/endgame' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getDestinyEndgame(body, env, ctx));
      }

      if (url.pathname === '/api/destiny/details' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getDestinyDetails(body, env, ctx));
      }

      if (url.pathname === '/api/destiny/career' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return json(await getDestinyCareer(body, env, ctx));
      }

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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

async function readJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  if (text.length > 64_000) throw httpError(413, 'BODY_TOO_LARGE', 'Request body is too large');
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}

async function getFireteams(env) {
  const configuredUrl = env.HEYBOX_SOURCE_URL || DEFAULT_HEYBOX_SOURCE_URL;
  const method = (env.HEYBOX_SOURCE_METHOD || 'GET').toUpperCase();
  const headers = parseJsonEnv(env.HEYBOX_SOURCE_HEADERS, {});
  const { response, text } = await requestText(
    configuredUrl,
    {
      method,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.6',
        'user-agent': 'Mozilla/5.0 Destiny2FireteamDashboard/1.0',
        ...headers
      },
      body: method === 'GET' || method === 'HEAD' ? undefined : env.HEYBOX_SOURCE_BODY
    },
    env
  );

  if (!response.ok) {
    throw httpError(response.status, 'HEYBOX_SOURCE_ERROR', `小黑盒数据源返回 HTTP ${response.status}`);
  }

  const payload = tryParseJson(text);
  if (!payload) {
    return {
      source: 'demo',
      updatedAt: new Date().toISOString(),
      warning: '小黑盒接口没有返回 JSON，当前显示演示数据。',
      items: SAMPLE_FIRETEAMS
    };
  }

  const items = normalizeXiaoheiheHomePayload(payload, configuredUrl);
  return {
    source: 'heybox',
    sourceUrl: configuredUrl,
    parser: 'xiaoheihe-common-team-v2',
    updatedAt: new Date().toISOString(),
    warning: payload.status && payload.status !== 'ok' ? payload.msg || '小黑盒接口返回异常状态。' : undefined,
    items
  };
}

async function getGuides(env, ctx) {
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

async function getGuide(slug, env, ctx) {
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

async function getGuideMedia(match, env) {
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

function normalizeXiaoheiheHomePayload(payload, sourceUrl) {
  const list = payload?.result?.team_list;
  if (!Array.isArray(list)) return [];

  return list
    .filter((item) => item && !item.is_room_delete)
    .map((item, index) => mapXiaoheiheTeam(item, index, sourceUrl))
    .filter(Boolean)
    .sort((a, b) => Number(a.expired) - Number(b.expired) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function mapXiaoheiheTeam(item, index, sourceUrl) {
  const content = cleanText(item.content_text || '');
  const tagTexts = Array.isArray(item.tags) ? item.tags.map((tag) => cleanText(tag.desc)).filter(Boolean) : [];
  const lightTags = tagTexts.filter((tag) => /^光等/.test(tag));
  const activityTags = tagTexts.filter((tag) => !/^光等/.test(tag));
  const expired = Boolean(item.is_expired || Number(item.remain_seconds) <= 0);
  const stateTag = item.is_full ? '已满' : expired ? '已过期' : stateLabel(item.display_state);
  const username = extractDestinyName(item.game_id || '') || extractDestinyName(content);
  const title = content ? content.slice(0, 54) : activityTags.join(' / ') || '小黑盒组队';
  const tags = [...activityTags, ...lightTags, stateTag].filter(Boolean);

  return {
    id: String(item.link_id || stableId(content, username, index)),
    source: 'heybox',
    title,
    activity: activityTags.join(' / '),
    content,
    author: item.user?.username || '',
    username,
    joinCommand: username ? `/j ${username}` : '',
    slots: parseXiaoheiheSlots(content),
    link: sourceUrl,
    createdAt: parseTime(item.modify_at) || null,
    tags,
    expired,
    remainingSeconds: Number(item.remain_seconds || 0),
    avatar: item.user?.avatar || item.user?.avartar || ''
  };
}

function stateLabel(displayState) {
  return { online: '在线', chat: '可聊天' }[displayState] || '';
}

function parseXiaoheiheSlots(content) {
  const eq = String(content || '').match(/(\d{1,2})\s*=\s*(\d{1,2})/);
  if (eq) {
    const current = Number(eq[1]);
    const missing = Number(eq[2]);
    return { current, max: current + missing };
  }

  const slash = String(content || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (slash) return { current: Number(slash[1]), max: Number(slash[2]) };
  return null;
}

async function getDestinyCareer(body, env, ctx) {
  const career = await getDestinySummary(body, env, ctx);
  const endgamePayload = await getDestinyEndgame(
    {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId,
      characters: career.characters
    },
    env,
    ctx
  );
  return attachEndgameToCareer(career, endgamePayload);
}

async function getDestinyPlayerSearch(body, env, ctx) {
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

async function getDestinyFireteam(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询当前队伍');
  }

  const modes = normalizeEndgameModes(body?.modes || body?.mode || ['raid', 'dungeon']);
  const includeEndgame = body?.includeEndgame === true;
  const anchor = await resolveFireteamAnchor(body, env, ctx);
  let transitory = {};
  let transitoryError = '';
  try {
    transitory = await fetchDestinyTransitory(anchor.account, env);
  } catch (error) {
    transitoryError = error.message || 'Bungie 当前队伍状态读取失败';
  }
  const rawPartyMembers = Array.isArray(transitory.partyMembers) ? transitory.partyMembers : [];
  const partyMembers = normalizeTransitoryParty(rawPartyMembers, anchor.account);
  const currentActivity = await summarizeTransitoryActivity(transitory.currentActivity || {}, env, ctx);
  const members = await mapWithConcurrency(
    partyMembers,
    Math.max(1, Math.min(4, positiveNumber(env.FIRETEAM_MEMBER_CONCURRENCY, 2))),
    (member) => getDestinyFireteamMember(member, anchor.account, modes, { includeEndgame }, env, ctx)
  );
  const resolvedMembers = members.filter((member) => !member.error).length;

  return {
    updatedAt: new Date().toISOString(),
    query: body?.bungieName || body?.name || anchor.account.displayName || '',
    modes,
    anchor: fireteamMemberAccount(anchor),
    currentActivity,
    joinability: normalizeJoinability(transitory.joinability),
    members,
    summary: {
      detectedMembers: rawPartyMembers.length,
      displayedMembers: members.length,
      resolvedMembers
    },
    message: fireteamMessage(rawPartyMembers, members, transitoryError),
    cache: {
      transitory: transitoryError ? 'error' : 'live',
      includeEndgame,
      note: transitoryError || 'Bungie Transitory 数据可能为空、延迟或只返回本人'
    }
  };
}

async function resolveFireteamAnchor(body, env, ctx) {
  const membershipType = body?.membershipType || body?.account?.membershipType;
  const membershipId = body?.membershipId || body?.account?.membershipId;
  if (membershipType && membershipId) {
    return getPublicCareerSummaryByMembership({ membershipType, membershipId }, env, ctx);
  }
  return getDestinySummary(body, env, ctx);
}

async function fetchDestinyTransitory(account, env) {
  const payload = await bungieFetch(
    `/Platform/Destiny2/${account.membershipType}/Profile/${account.membershipId}/?components=1000`,
    { method: 'GET', timeoutMs: positiveNumber(env.FIRETEAM_TRANSITORY_TIMEOUT_MS, 3500) },
    env
  );
  return payload.Response?.profileTransitoryData?.data || {};
}

function normalizeTransitoryParty(partyMembers, anchorAccount) {
  const seen = new Set();
  const normalized = [];
  for (const member of partyMembers) {
    const membershipId = cleanText(member?.membershipId || member?.destinyMembershipId || '');
    if (!membershipId || seen.has(membershipId)) continue;
    seen.add(membershipId);
    normalized.push({
      membershipId,
      membershipType: member?.membershipType || anchorAccount.membershipType,
      emblemHash: member?.emblemHash || '',
      status: member?.status ?? null,
      source: 'transitory'
    });
  }

  const anchorId = cleanText(anchorAccount.membershipId);
  if (anchorId && !seen.has(anchorId)) {
    normalized.unshift({
      membershipId: anchorId,
      membershipType: anchorAccount.membershipType,
      status: null,
      source: normalized.length ? 'queried-player' : 'fallback-anchor'
    });
  }
  return normalized;
}

async function getDestinyFireteamMember(member, anchorAccount, modes, options, env, ctx) {
  const startedAt = Date.now();
  try {
    const summary = await getPublicCareerSummaryByMembership(
      {
        membershipType: member.membershipType || anchorAccount.membershipType,
        membershipId: member.membershipId
      },
      env,
      ctx
    );
    let endgamePayload = null;
    let endgameError = '';
    if (options?.includeEndgame) {
      try {
        endgamePayload = await getDestinyEndgame(
          {
            membershipType: summary.account.membershipType,
            membershipId: summary.account.membershipId,
            characters: summary.characters,
            modes
          },
          env,
          ctx
        );
      } catch (error) {
        endgameError = error.message || '队伍成员高难活动数据读取失败';
      }
    }

    const stats = { ...(summary.stats || {}) };
    if (endgamePayload?.statsPatch?.raid) stats.raid = endgamePayload.statsPatch.raid;
    if (endgamePayload?.statsPatch?.dungeon) stats.dungeon = endgamePayload.statsPatch.dungeon;
    return {
      membershipId: member.membershipId,
      membershipType: summary.account.membershipType,
      status: member.status,
      statusLabel: transitoryStatusLabel(member.status),
      source: member.source,
      account: summary.account,
      profile: summary.profile,
      characters: summary.characters,
      stats,
      endgame: endgamePayload?.endgame || {},
      cache: {
        ...(summary.cache || {}),
        ...(endgamePayload?.cache || {})
      },
      warnings: endgameError ? [endgameError] : [],
      elapsedMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      membershipId: member.membershipId,
      membershipType: member.membershipType || anchorAccount.membershipType,
      status: member.status,
      statusLabel: transitoryStatusLabel(member.status),
      source: member.source,
      error: error.message || '队伍成员资料读取失败',
      elapsedMs: Date.now() - startedAt
    };
  }
}

async function getPublicCareerSummaryByMembership(membership, env, ctx) {
  const membershipId = cleanText(membership?.membershipId);
  const preferredType = cleanText(membership?.membershipType || '');
  if (!membershipId) throw httpError(400, 'INVALID_MEMBERSHIP_ID', '缺少 Destiny membershipId');

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

async function fetchPublicProfileByMembership(membershipId, preferredType, env) {
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
  throw lastError || httpError(404, 'PLAYER_PROFILE_NOT_FOUND', '没有找到该队伍成员的公开资料');
}

function parsedNameFromMembership(membership) {
  const displayName = cleanText(membership.bungieGlobalDisplayName || membership.displayName || membership.membershipId || 'Guardian');
  const displayNameCode = Number(membership.bungieGlobalDisplayNameCode || membership.displayNameCode || 0);
  return {
    displayName,
    displayNameCode
  };
}

async function summarizeTransitoryActivity(activity, env, ctx) {
  const hash = cleanText(
    activity?.currentActivityHash ||
    activity?.activityHash ||
    activity?.referenceId ||
    activity?.directorActivityHash ||
    activity?.activityDetails?.referenceId ||
    activity?.activityDetails?.directorActivityHash ||
    ''
  );
  let definition = null;
  if (hash) {
    try {
      definition = await resolveActivityDefinition(hash, env, ctx);
    } catch {
      definition = fallbackActivityDefinition(hash);
    }
  }
  const startTime = parseTime(activity?.startTime);
  return {
    hash,
    name: definition && definition.source !== 'fallback' ? definition.name : '',
    image: definition?.image || '',
    startTime,
    elapsedSeconds: startTime ? Math.max(0, Math.round((Date.now() - new Date(startTime).getTime()) / 1000)) : 0,
    score: Number(activity?.score || 0),
    numberOfPlayers: Number(activity?.numberOfPlayers || 0),
    numberOfOpponents: Number(activity?.numberOfOpponents || 0),
    rawAvailable: Boolean(activity && Object.keys(activity).length)
  };
}

function normalizeJoinability(joinability) {
  if (!joinability || typeof joinability !== 'object') {
    return {
      openSlots: null,
      privacySetting: null,
      closedReasons: null,
      label: '未知'
    };
  }
  const openSlots = Number(joinability.openSlots || 0);
  const closedReasons = Number(joinability.closedReasons || 0);
  return {
    openSlots,
    privacySetting: Number(joinability.privacySetting || 0),
    closedReasons,
    label: openSlots > 0 && !closedReasons ? '可加入' : closedReasons ? '不可加入' : '无空位'
  };
}

function fireteamMemberAccount(summary) {
  return {
    displayName: summary.account?.displayName || '',
    membershipType: summary.account?.membershipType || '',
    membershipTypeName: summary.account?.membershipTypeName || '',
    membershipId: summary.account?.membershipId || ''
  };
}

function fireteamMessage(rawPartyMembers, members, transitoryError = '') {
  if (transitoryError) return `Bungie 当前队伍状态读取失败，先展示被查询玩家本人：${transitoryError}`;
  if (!rawPartyMembers.length) return 'Bungie 当前队伍状态未公开，先展示被查询玩家本人。';
  if (members.length <= 1) return '当前只检测到该玩家本人，可能未在公开队伍或状态不可见。';
  const failed = members.filter((member) => member.error).length;
  if (failed) return `已检测到 ${members.length} 名成员，其中 ${failed} 名成员公开资料读取失败。`;
  return `已检测到 ${members.length} 名当前队伍成员。`;
}

function transitoryStatusLabel(status) {
  if (status == null) return '';
  const number = Number(status);
  const map = {
    0: '未知',
    1: '离线',
    2: '在线',
    3: '在线',
    4: '在线',
    5: '在线',
    6: '在线',
    7: '在线',
    8: '在线',
    9: '游戏中'
  };
  return map[number] || `状态 ${number}`;
}

async function searchBungiePlayersByPrefix(query, limit, env) {
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

async function getDestinySummary(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const parsedName = parseBungieName(body?.bungieName || body?.name || '');
  if (!parsedName) {
    throw httpError(400, 'INVALID_BUNGIE_NAME', '请输入棒鸡名称，格式为 名称#数字代码');
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
      throw httpError(404, 'PLAYER_NOT_FOUND', '没有找到这个棒鸡玩家');
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

async function getDestinyEndgame(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const target = await resolveEndgameTarget(body, env, ctx);
  const modes = normalizeEndgameModes(body?.modes || body?.mode);
  const historyConfig = modes.map((mode) => `${mode}:${historyPageLimit(mode, env)}x${historyPageSize(mode, env)}`).join(',');
  const characterIds = target.characters.map((character) => character.id).filter(Boolean).sort().join(',');
  const cacheKey = [
    'endgame',
    CACHE_VERSION,
    env.BUNGIE_LOCALE || 'zh-chs',
    historyConfig,
    modes.join(','),
    target.membership.membershipType,
    target.membership.membershipId,
    characterIds
  ].join(':');
  const cached = await getWorkerCachedJson(
    cacheKey,
    endgameCacheTtlSeconds(env),
    async () => getEndgameCareer(target.membership, target.characters, modes, env, ctx),
    env,
    ctx,
    { persistLarge: true }
  );
  const endgame = cached.value;

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    account: {
      membershipType: target.membership.membershipType,
      membershipId: target.membership.membershipId
    },
    endgame,
    statsPatch: buildEndgameStatsPatch(endgame),
    cache: {
      endgame: cached.status,
      hitLevel: cached.status,
      endgameHitLevel: cached.status,
      endgameCachedAt: cached.cachedAt,
      endgameTtlSeconds: cached.ttlSeconds,
      r2Key: cached.r2Key || '',
      byteSize: cached.byteSize || 0,
      endgameR2Key: cached.r2Key || '',
      endgameByteSize: cached.byteSize || 0
    }
  };
}

async function getDestinyDetails(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const target = await resolveDetailsTarget(body, env, ctx);
  const cacheKey = [
    'profile-details-v3',
    CACHE_VERSION,
    env.BUNGIE_LOCALE || 'zh-chs',
    target.membership.membershipType,
    target.membership.membershipId
  ].join(':');

  const cached = await getWorkerCachedJson(
    cacheKey,
    summaryCacheTtlSeconds(env),
    async () => {
      const profile = await bungieFetch(
        `/Platform/Destiny2/${target.membership.membershipType}/Profile/${target.membership.membershipId}/?components=900,1300`,
        { method: 'GET' },
        env
      );
      return summarizeDestinyDetails(target.membership, profile.Response || {}, env, ctx);
    },
    env,
    ctx,
    { persistLarge: true }
  );

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    account: {
      membershipType: target.membership.membershipType,
      membershipId: target.membership.membershipId
    },
    details: cached.value,
    cache: {
      details: cached.status,
      hitLevel: cached.status,
      detailsHitLevel: cached.status,
      detailsCachedAt: cached.cachedAt,
      detailsTtlSeconds: cached.ttlSeconds,
      r2Key: cached.r2Key || '',
      byteSize: cached.byteSize || 0,
      detailsR2Key: cached.r2Key || '',
      detailsByteSize: cached.byteSize || 0
    }
  };
}

async function resolveDetailsTarget(body, env, ctx) {
  const membershipType = body?.membershipType || body?.account?.membershipType;
  const membershipId = body?.membershipId || body?.account?.membershipId;
  if (membershipType && membershipId) {
    return {
      membership: {
        membershipType,
        membershipId
      }
    };
  }

  const career = await getDestinySummary(body, env, ctx);
  return {
    membership: {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId
    }
  };
}

async function resolveEndgameTarget(body, env, ctx) {
  const membershipType = body?.membershipType || body?.account?.membershipType;
  const membershipId = body?.membershipId || body?.account?.membershipId;
  if (membershipType && membershipId) {
    const membership = {
      membershipType,
      membershipId
    };
    let characters = normalizeCharacterRefs(body?.characters);
    if (!characters.length) {
      characters = await fetchCharacterRefs(membership, env);
    }
    return { membership, characters };
  }

  const career = await getDestinySummary(body, env, ctx);
  return {
    membership: {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId
    },
    characters: normalizeCharacterRefs(career.characters)
  };
}

async function fetchCharacterRefs(membership, env) {
  const profile = await bungieFetch(
    `/Platform/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=200`,
    { method: 'GET' },
    env
  );
  return normalizeCharacterRefs(Object.values(profile.Response?.characters?.data || {}));
}

function normalizeCharacterRefs(characters) {
  return (Array.isArray(characters) ? characters : [])
    .map((character) => ({
      id: String(character?.id || character?.characterId || '')
    }))
    .filter((character) => character.id);
}

function attachEndgameToCareer(career, endgamePayload) {
  const endgame = endgamePayload.endgame || endgamePayload;
  career.endgame = {
    ...(career.endgame || {}),
    ...endgame
  };
  career.stats = career.stats || {};
  if (endgame.raid?.total) career.stats.raid = endgame.raid.total;
  if (endgame.dungeon?.total) career.stats.dungeon = endgame.dungeon.total;
  career.cache = {
    ...(career.cache || {}),
    ...(endgamePayload.cache || {})
  };
  return career;
}

function normalizeEndgameModes(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : ['raid', 'dungeon'];
  const modes = raw.map((item) => String(item || '').toLowerCase()).filter((item) => item === 'raid' || item === 'dungeon' || item === 'pvp');
  return Array.from(new Set(modes.length ? modes : ['raid', 'dungeon']));
}

function historyPageLimit(modeName, env) {
  if (modeName === 'pvp') {
    return positiveNumber(env.PVP_HISTORY_PAGE_LIMIT, positiveNumber(env.ENDGAME_HISTORY_PAGE_LIMIT, 50));
  }
  return positiveNumber(env.ENDGAME_HISTORY_PAGE_LIMIT, 50);
}

function historyPageSize(modeName, env) {
  if (modeName === 'pvp') {
    return positiveNumber(env.PVP_HISTORY_PAGE_SIZE, positiveNumber(env.ENDGAME_HISTORY_PAGE_SIZE, 250));
  }
  return positiveNumber(env.ENDGAME_HISTORY_PAGE_SIZE, 250);
}

function buildEndgameStatsPatch(endgame) {
  const patch = {};
  if (endgame.raid?.total) patch.raid = endgame.raid.total;
  if (endgame.dungeon?.total) patch.dungeon = endgame.dungeon.total;
  return patch;
}

async function summarizeDestinyDetails(membership, profileResponse, env, ctx) {
  const recordsComponent = profileResponse.profileRecords || {};
  const craftablesComponent = profileResponse.characterCraftables || {};
  const crafting = await summarizeCrafting(craftablesComponent.data || {}, env, ctx, recordsComponent.data?.records || {});
  return {
    records: summarizeRecords(recordsComponent.data || {}, recordsComponent.privacy),
    crafting: {
      ...crafting,
      privacy: privacyLabel(craftablesComponent.privacy)
    },
    privacy: {
      records: privacyLabel(recordsComponent.privacy),
      craftables: privacyLabel(craftablesComponent.privacy)
    },
    membership: {
      membershipType: membership.membershipType,
      membershipId: membership.membershipId
    }
  };
}

function summarizeRecords(records, privacy) {
  const allRecords = Object.values(records.records || {});
  const visibleRecords = allRecords.filter((record) => (Number(record.state || 0) & 16) === 0);
  const completedRecords = visibleRecords.filter((record) => (Number(record.state || 0) & 4) === 0);
  const redeemedRecords = visibleRecords.filter((record) => (Number(record.state || 0) & 1) !== 0);
  return {
    privacy: privacyLabel(privacy),
    score: numberStat(records.score || 0),
    activeScore: numberStat(records.activeScore || records.score || 0),
    legacyScore: numberStat(records.legacyScore || 0),
    lifetimeScore: numberStat(records.lifetimeScore || 0),
    recordCount: numberStat(visibleRecords.length),
    completedRecords: numberStat(completedRecords.length),
    redeemedRecords: numberStat(redeemedRecords.length),
    completionRate: percentStat(numberStat(completedRecords.length), numberStat(visibleRecords.length))
  };
}

async function summarizeCrafting(characterCraftables, env, ctx, profileRecords = {}) {
  const aggregate = new Map();
  for (const [characterId, component] of Object.entries(characterCraftables || {})) {
    for (const [hash, craftable] of Object.entries(component?.craftables || {})) {
      const item = aggregate.get(hash) || {
        hash,
        visible: false,
        unlocked: false,
        failedRequirementCount: 0,
        socketCount: 0,
        plugCount: 0,
        unlockedPlugCount: 0,
        characterIds: new Set()
      };
      const visible = Boolean(craftable.visible);
      const recipeUnlocked = visible && !hasFailures(craftable.failedRequirementIndexes);
      const sockets = Array.isArray(craftable.sockets) ? craftable.sockets : [];
      let plugCount = 0;
      let unlockedPlugCount = 0;
      for (const socket of sockets) {
        for (const plug of socket.plugs || []) {
          plugCount += 1;
          if (!hasFailures(plug.failedRequirementIndexes)) unlockedPlugCount += 1;
        }
      }

      item.visible = item.visible || visible;
      item.unlocked = item.unlocked || recipeUnlocked;
      item.failedRequirementCount = Math.max(item.failedRequirementCount, Array.isArray(craftable.failedRequirementIndexes) ? craftable.failedRequirementIndexes.length : 0);
      item.socketCount = Math.max(item.socketCount, sockets.length);
      item.plugCount = Math.max(item.plugCount, plugCount);
      item.unlockedPlugCount = Math.max(item.unlockedPlugCount, unlockedPlugCount);
      item.characterIds.add(characterId);
      aggregate.set(hash, item);
    }
  }

  const entries = Array.from(aggregate.values()).filter((item) => item.visible);
  const enriched = await enrichCraftableItems(entries, env, ctx, profileRecords);
  const unlocked = entries.filter((item) => item.unlocked).length;
  const plugCount = entries.reduce((sum, item) => sum + item.plugCount, 0);
  const unlockedPlugCount = entries.reduce((sum, item) => sum + item.unlockedPlugCount, 0);

  return {
    total: numberStat(entries.length),
    unlocked: numberStat(unlocked),
    locked: numberStat(Math.max(0, entries.length - unlocked)),
    completionRate: percentStat(numberStat(unlocked), numberStat(entries.length)),
    plugTotal: numberStat(plugCount),
    plugUnlocked: numberStat(unlockedPlugCount),
    plugCompletionRate: percentStat(numberStat(unlockedPlugCount), numberStat(plugCount)),
    items: enriched
  };
}

async function enrichCraftableItems(items, env, ctx, profileRecords = {}) {
  const selected = items
    .sort((a, b) => Number(a.unlocked) - Number(b.unlocked) || b.unlockedPlugCount - a.unlockedPlugCount || Number(a.hash) - Number(b.hash))
    .slice(0, 260);
  const definitions = await getInventoryItemDefinitions(selected.map((item) => item.hash), env, ctx);
  return selected.map((item) => {
    const definition = definitions.get(String(item.hash)) || {};
    const craftingInfo = definition.craftingInfo || {};
    const pattern = craftingPatternProgress(craftingInfo, profileRecords, item.unlocked);
    return {
      hash: item.hash,
      name: cleanText(definition.displayProperties?.name) || `装备 ${item.hash}`,
      type: definition.itemTypeDisplayName || '',
      icon: inventoryItemIcon(definition),
      tier: definition.inventory?.tierTypeName || '',
      source: cleanText(craftingInfo.source) || '其他来源',
      sourceHash: craftingInfo.sourceHash || 0,
      patternRecordHash: craftingInfo.patternRecordHash || 0,
      patternObjectiveHash: craftingInfo.patternObjectiveHash || 0,
      pattern,
      visible: Boolean(item.visible),
      unlocked: Boolean(item.unlocked),
      failedRequirementCount: numberStat(item.failedRequirementCount),
      socketCount: numberStat(item.socketCount),
      plugCount: numberStat(item.plugCount),
      unlockedPlugCount: numberStat(item.unlockedPlugCount),
      plugCompletionRate: percentStat(numberStat(item.unlockedPlugCount), numberStat(item.plugCount)),
      characterCount: numberStat(item.characterIds.size)
    };
  });
}

async function getInventoryItemDefinitions(hashes, env, ctx) {
  const uniqueHashes = Array.from(new Set(hashes.filter(Boolean).map(String)));
  const staticItems = await loadStaticGearItems(env, ctx);
  const byHash = new Map(staticItems.map((item) => [String(item.hash), item]));
  const entries = uniqueHashes.map((hash) => {
      if (ITEM_DEFINITION_CACHE.has(hash)) return [hash, ITEM_DEFINITION_CACHE.get(hash)];
      const item = byHash.get(hash);
      const definition = item
        ? {
            displayProperties: {
              name: item.name,
              icon: item.icon || ''
            },
            itemTypeDisplayName: item.weaponType || item.type || '',
            inventory: {
              tierTypeName: item.tier || ''
            },
            craftingInfo: {
              source: item.source || '',
              sourceHash: item.sourceHash || 0,
              patternRecordHash: item.patternRecordHash || 0,
              patternObjectiveHash: item.patternObjectiveHash || 0,
              outputItemHash: item.outputItemHash || 0,
              outputCollectibleHash: item.outputCollectibleHash || 0,
              watermark: item.watermark || ''
            }
          }
        : {};
      ITEM_DEFINITION_CACHE.set(hash, definition);
      return [hash, definition];
  });

  const missing = entries
    .filter(([, definition]) => !definition.displayProperties?.name)
    .slice(0, 18)
    .map(([hash]) => hash);
  const fetched = await mapWithConcurrency(missing, activityDefinitionConcurrency(env), async (hash) => {
    try {
      const payload = await bungieFetch(
        `/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/?lc=${encodeURIComponent(env.BUNGIE_LOCALE || 'zh-chs')}`,
        { method: 'GET' },
        env
      );
      const definition = payload.Response || {};
      ITEM_DEFINITION_CACHE.set(hash, definition);
      return [hash, definition];
    } catch {
      return [hash, ITEM_DEFINITION_CACHE.get(hash) || {}];
    }
  });

  return new Map(
    entries.map(([hash, definition]) => {
      const fallback = fetched.find(([itemHash]) => itemHash === hash);
      return fallback || [hash, definition];
    })
  );
}

async function loadStaticGearItems(env, ctx) {
  if (!env.ASSETS?.fetch) return [];
  const locale = env.BUNGIE_LOCALE || 'zh-chs';
  const cacheKey = ['static-gear-items', CACHE_VERSION, locale].join(':');
  const cached = await getWorkerCachedJson(
    cacheKey,
    positiveNumber(env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800),
    async () => {
      const response = await env.ASSETS.fetch(new Request(`https://assets.local/data/gear-index-${locale}.json`));
      if (!response.ok) return [];
      const index = await response.json();
      return [
        ...(index.items || []).filter((item) => item.kind === 'weapon'),
        ...(index.craftables || [])
      ];
    },
    env,
    ctx,
    { memoryOnly: true }
  );
  return cached.value || [];
}

function inventoryItemIcon(definition) {
  const icon = definition.displayProperties?.icon || '';
  if (!icon) return '';
  return icon.startsWith('http') ? icon : `https://www.bungie.net${icon}`;
}

function craftingPatternProgress(craftingInfo, profileRecords, unlocked) {
  const recordHash = craftingInfo.patternRecordHash ? String(craftingInfo.patternRecordHash) : '';
  const objectiveHash = craftingInfo.patternObjectiveHash ? String(craftingInfo.patternObjectiveHash) : '';
  const record = recordHash ? profileRecords?.[recordHash] : null;
  const objective = (record?.objectives || []).find((entry) => String(entry.objectiveHash) === objectiveHash) || record?.objectives?.[0] || null;
  if (!objective) {
    const fallback = unlocked ? 1 : 0;
    return {
      current: numberStat(fallback),
      required: numberStat(unlocked ? 1 : 0),
      complete: Boolean(unlocked),
      label: unlocked ? '1/1' : '-',
      percent: unlocked ? 100 : 0
    };
  }

  const required = Math.max(0, Number(objective.completionValue || 0));
  const current = Math.max(0, Math.min(required || Number(objective.progress || 0), Number(objective.progress || 0)));
  const complete = Boolean(objective.complete) || (required > 0 && current >= required);
  return {
    current: numberStat(current),
    required: numberStat(required),
    complete,
    label: required > 0 ? `${current}/${required}` : '-',
    percent: required > 0 ? Math.max(0, Math.min(100, (current / required) * 100)) : 0
  };
}

function hasFailures(value) {
  return Array.isArray(value) && value.length > 0;
}

function privacyLabel(value) {
  const number = Number(value);
  if (number === 1) return 'public';
  if (number === 2) return 'private';
  return 'none';
}

async function getWorkerCachedJson(key, ttlSeconds, producer, env, ctx, options = {}) {
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

function waitForCacheWrite(write, ctx) {
  const safeWrite = Promise.resolve(write).catch(() => undefined);
  if (ctx?.waitUntil) {
    ctx.waitUntil(safeWrite);
  }
}

function summaryCacheTtlSeconds(env) {
  return positiveNumber(env.SUMMARY_CACHE_TTL_SECONDS, positiveNumber(env.CAREER_CACHE_TTL_SECONDS, 300));
}

function endgameCacheTtlSeconds(env) {
  return positiveNumber(env.ENDGAME_CACHE_TTL_SECONDS, positiveNumber(env.CAREER_CACHE_TTL_SECONDS, 900));
}

function guideIndexCacheTtlSeconds(env) {
  return positiveNumber(env.GUIDE_INDEX_CACHE_TTL_SECONDS, 300);
}

function activityDefinitionCacheTtlSeconds(env) {
  return positiveNumber(env.ACTIVITY_DEFINITION_CACHE_TTL_SECONDS, 31536000);
}

function activityDefinitionConcurrency(env) {
  return Math.max(1, Math.min(6, positiveNumber(env.ACTIVITY_DEFINITION_CONCURRENCY, 4)));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function workerGearDeps(env, ctx) {
  const locale = env.BUNGIE_LOCALE || 'zh-chs';
  return {
    apiKey: env.BUNGIE_API_KEY,
    locale,
    timeoutMs: positiveNumber(env.GEAR_MANIFEST_TIMEOUT_MS, positiveNumber(env.REQUEST_TIMEOUT_MS, 30000)),
    maxBytes: positiveNumber(env.GEAR_MANIFEST_MAX_BYTES, 80_000_000),
    cacheTtlSeconds: positiveNumber(env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800),
    loadStaticGearIndex: async () => {
      if (!env.ASSETS?.fetch) return null;
      const response = await env.ASSETS.fetch(new Request(`https://assets.local/data/gear-index-${locale}.json`));
      if (response.status === 404) return null;
      if (!response.ok) {
        throw httpError(response.status, 'STATIC_GEAR_INDEX_ERROR', `Static gear index returned HTTP ${response.status}`);
      }
      return response.json();
    },
    getCachedJson: (key, ttlSeconds, producer, options) => getWorkerCachedJson(key, ttlSeconds, producer, env, ctx, options)
  };
}

async function bungieFetch(pathname, options, env) {
  const { response, text } = await requestText(
    `https://www.bungie.net${pathname}`,
    {
      ...options,
      maxBytes: positiveNumber(env.BUNGIE_MAX_BYTES, 20_000_000),
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.BUNGIE_API_KEY,
        'accept-language': env.BUNGIE_LOCALE || 'zh-chs',
        ...(options.headers || {})
      }
    },
    env
  );

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw httpError(502, 'BUNGIE_INVALID_JSON', 'Bungie API returned invalid JSON');
  }

  if (!response.ok || (payload.ErrorCode && payload.ErrorCode !== 1)) {
    throw httpError(response.ok ? 502 : response.status || 502, 'BUNGIE_API_ERROR', payload.Message || `Bungie API returned HTTP ${response.status}`);
  }
  return payload;
}

async function requestText(url, options, env) {
  const { maxBytes = Number(env.HEYBOX_MAX_BYTES || 2_000_000), timeoutMs: requestTimeoutMs, ...fetchOptions } = options || {};
  const controller = new AbortController();
  const timeoutMs = Number(requestTimeoutMs || env.REQUEST_TIMEOUT_MS || 15000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength && contentLength > maxBytes) {
      throw httpError(502, 'SOURCE_TOO_LARGE', `Source response is larger than ${maxBytes} bytes`);
    }
    const text = await response.text();
    if (text.length > maxBytes) {
      throw httpError(502, 'SOURCE_TOO_LARGE', `Source response is larger than ${maxBytes} bytes`);
    }
    return { response, text };
  } catch (error) {
    if (error.name === 'AbortError') throw httpError(504, 'REQUEST_TIMEOUT', 'External request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseBungieName(input) {
  const text = cleanText(input);
  const match = text.match(/^(.{1,32})#(\d{3,8})$/u);
  if (!match) return null;
  return {
    displayName: match[1].trim(),
    displayNameCode: Number(match[2])
  };
}

function selectMembership(memberships) {
  return (
    memberships.find((item) => Number(item.crossSaveOverride) > 0 && Number(item.crossSaveOverride) === Number(item.membershipType)) ||
    memberships.find((item) => Number(item.crossSaveOverride) > 0) ||
    memberships[0]
  );
}

function summarizeCareer(query, membership, memberships, profileResponse, statsResponse) {
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

async function getEndgameCareer(membership, characters, modes = ['raid', 'dungeon'], env, ctx) {
  const modeConfig = {
    raid: { apiMode: 4, hashes: new Map() },
    dungeon: { apiMode: 82, hashes: new Map() },
    pvp: { apiMode: 5, hashes: new Map() }
  };
  const selectedModes = normalizeEndgameModes(modes);
  const warnings = [];

  await Promise.all(
    characters.flatMap((character) =>
      selectedModes.map((modeName) =>
        collectEndgameHistory(
          membership,
          character.id,
          modeName,
          modeConfig[modeName].apiMode,
          historyPageSize(modeName, env),
          historyPageLimit(modeName, env),
          modeConfig[modeName].hashes,
          warnings,
          env
        )
      )
    )
  );

  const hashes = selectedModes.flatMap((modeName) =>
    [...modeConfig[modeName].hashes.values()].flatMap((item) =>
      item.definitionHashes?.size ? [...item.definitionHashes] : [item.hash]
    )
  );
  const definitions = await getActivityDefinitions(hashes, warnings, env, ctx);

  const result = {
    pageConfig: Object.fromEntries(selectedModes.map((modeName) => [modeName, {
      pageLimit: historyPageLimit(modeName, env),
      pageSize: historyPageSize(modeName, env)
    }])),
    warnings
  };
  for (const modeName of selectedModes) {
    result[modeName] = buildEndgameMode(modeName, modeConfig[modeName].hashes, definitions);
  }
  return result;
}

async function collectEndgameHistory(membership, characterId, modeName, mode, pageSize, pageLimit, output, warnings, env) {
  for (let page = 0; page < pageLimit; page += 1) {
    const payload = await bungieFetch(
      `/Platform/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Character/${characterId}/Stats/Activities/?mode=${mode}&count=${pageSize}&page=${page}`,
      { method: 'GET' },
      env
    );
    const activities = Array.isArray(payload.Response?.activities) ? payload.Response.activities : [];
    for (const activity of activities) {
      addEndgameActivity(output, activity, characterId, modeName);
    }
    if (activities.length < pageSize) return;
  }

  warnings.push(`${modeName}:${characterId} reached page limit ${pageLimit}`);
}

function addEndgameActivity(output, activity, characterId, modeName) {
  const hash = String(activity.activityDetails?.referenceId || activity.activityDetails?.directorActivityHash || '');
  if (!hash) return;
  const directorHash = String(activity.activityDetails?.directorActivityHash || '');
  const definitionHashes = new Set([hash, directorHash].filter(Boolean));
  const activityMode = Number(activity.activityDetails?.mode || 0);
  const activityModes = Array.isArray(activity.activityDetails?.modes) ? activity.activityDetails.modes.map(Number).filter(Boolean) : [];
  const key = modeName === 'pvp' ? `${hash}:${activityMode || 'unknown'}` : hash;

  if (!output.has(key)) {
    output.set(key, {
      hash,
      mode: modeName,
      definitionHashes: new Set(definitionHashes),
      activityMode,
      activityModes: new Set(activityModes),
      attempts: 0,
      wins: 0,
      clears: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      seconds: 0,
      soloClears: 0,
      soloFlawlessClears: 0,
      bestSeconds: null,
      lastPlayed: null,
      characters: new Set()
    });
  }

  const item = output.get(key);
  for (const definitionHash of definitionHashes) item.definitionHashes.add(definitionHash);
  const values = activity.values || {};
  const completed = statValue(values.completed) > 0;
  const won = modeName === 'pvp' ? statValue(values.standing) === 0 : false;
  const playerCount = statValue(values.playerCount);
  const deaths = statValue(values.deaths);
  const isSolo = completed && playerCount === 1;
  const isSoloFlawless = isSolo && deaths === 0;
  const seconds = statValue(values.timePlayedSeconds) || statValue(values.activityDurationSeconds);
  item.attempts += 1;
  item.wins += won ? 1 : 0;
  item.clears += completed ? 1 : 0;
  item.kills += statValue(values.kills);
  item.deaths += deaths;
  item.assists += statValue(values.assists);
  item.opponentsDefeated = Number(item.opponentsDefeated || 0) + statValue(values.opponentsDefeated);
  item.seconds += seconds;
  item.soloClears += isSolo ? 1 : 0;
  item.soloFlawlessClears += isSoloFlawless ? 1 : 0;
  item.characters.add(characterId);
  for (const id of activityModes) item.activityModes.add(id);

  if (completed && seconds > 0 && (item.bestSeconds == null || seconds < item.bestSeconds)) {
    item.bestSeconds = seconds;
  }
  if (activity.period && (!item.lastPlayed || new Date(activity.period) > new Date(item.lastPlayed))) {
    item.lastPlayed = activity.period;
  }
}

async function getActivityDefinitions(hashes, warnings, env, ctx) {
  const uniqueHashes = Array.from(new Set(hashes.filter(Boolean)));
  const entries = await mapWithConcurrency(
    uniqueHashes,
    activityDefinitionConcurrency(env),
    async (hash) => {
      if (ACTIVITY_DEFINITION_CACHE.has(hash)) return [hash, ACTIVITY_DEFINITION_CACHE.get(hash)];
      try {
        const mapped = await resolveActivityDefinition(hash, env, ctx);
        ACTIVITY_DEFINITION_CACHE.set(hash, mapped);
        return [hash, mapped];
      } catch (error) {
        warnings.push(`activity:${hash}:${error.code || error.message}`);
        return [hash, fallbackActivityDefinition(hash)];
      }
    }
  );
  return new Map(entries);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

async function getCachedActivityDefinition(hash, env, ctx) {
  const cacheKey = ['activity-definition', CACHE_VERSION, env.BUNGIE_LOCALE || 'zh-chs', hash].join(':');
  const ttlSeconds = activityDefinitionCacheTtlSeconds(env);
  const cached = await getWorkerCachedJson(cacheKey, ttlSeconds, () => fetchLiveActivityDefinition(hash, env), env, ctx);
  if (!isValidActivityDefinition(cached.value)) {
    const value = await fetchLiveActivityDefinition(hash, env);
    const cachedAt = new Date().toISOString();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    setMemoryCache(cacheKey, value, cachedAt, expiresAt);
    writeEdgeCache(cacheKey, value, cachedAt, expiresAt, ttlSeconds, ctx);
    writeKvCache(cacheKey, value, cachedAt, expiresAt, ttlSeconds, env, ctx);
    return value;
  }
  return cached.value;
}

async function fetchLiveActivityDefinition(hash, env) {
  const payload = await bungieFetch(
    `/Platform/Destiny2/Manifest/DestinyActivityDefinition/${hash}/?lc=${encodeURIComponent(env.BUNGIE_LOCALE || 'zh-chs')}`,
    { method: 'GET' },
    env
  );
  const definition = payload.Response || {};
  const mapped = {
    hash: String(hash),
    name: cleanText(definition.displayProperties?.name) || `活动 ${hash}`,
    description: cleanText(definition.displayProperties?.description),
    image: definition.pgcrImage ? `https://www.bungie.net${definition.pgcrImage}` : '',
    activityTypeHash: definition.activityTypeHash || null,
    modeTypes: Array.isArray(definition.modeTypes) ? definition.modeTypes : [],
    directorActivityHash: definition.directorActivityHash || null,
    placeHash: definition.placeHash || null,
    destinationHash: definition.destinationHash || null,
    source: 'live'
  };
  if (!isValidActivityDefinition(mapped)) {
    throw httpError(502, 'ACTIVITY_DEFINITION_EMPTY', `Activity definition ${hash} did not contain a usable name`);
  }
  return mapped;
}

async function resolveActivityDefinition(hash, env, ctx) {
  const staticDefinition = await getStaticActivityDefinition(hash, env, ctx);
  if (isValidActivityDefinition(staticDefinition)) return staticDefinition;
  return getCachedActivityDefinition(hash, env, ctx);
}

async function getStaticActivityDefinition(hash, env, ctx) {
  const index = await loadStaticActivityIndex(env, ctx);
  const definition = index?.activities?.[String(hash)];
  if (!definition) return null;
  return {
    ...definition,
    hash: String(definition.hash || hash),
    source: 'static'
  };
}

async function loadStaticActivityIndex(env, ctx) {
  const locale = env.BUNGIE_LOCALE || 'zh-chs';
  if (ACTIVITY_INDEX_CACHE.has(locale)) return ACTIVITY_INDEX_CACHE.get(locale);
  if (!env.ASSETS?.fetch) return null;

  const load = Promise.resolve()
    .then(async () => {
      const response = await env.ASSETS.fetch(new Request(`https://assets.local/data/activity-index-${locale}.json`));
      if (response.status === 404) return null;
      if (!response.ok) {
        throw httpError(response.status, 'STATIC_ACTIVITY_INDEX_ERROR', `Static activity index returned HTTP ${response.status}`);
      }
      return response.json();
    })
    .catch(() => null);
  waitForCacheWrite(load, ctx);
  const index = await load;
  ACTIVITY_INDEX_CACHE.set(locale, index);
  return index;
}

function fallbackActivityDefinition(hash) {
  return {
    hash: String(hash),
    name: `活动 ${hash}`,
    description: '',
    image: '',
    activityTypeHash: null,
    modeTypes: [],
    directorActivityHash: null,
    placeHash: null,
    destinationHash: null,
    source: 'fallback'
  };
}

function buildEndgameMode(modeName, hashGroups, definitions) {
  const byName = new Map();

  for (const item of hashGroups.values()) {
    const definition = definitionForEndgameItem(item, definitions);
    const name = normalizeEndgameActivityName(definition.name || `活动 ${item.hash}`);
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        mode: modeName,
        activityMode: item.activityMode || 0,
        activityModes: new Set(),
        attempts: 0,
        wins: 0,
        clears: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        opponentsDefeated: 0,
        seconds: 0,
        soloClears: 0,
        soloFlawlessClears: 0,
        bestSeconds: null,
        lastPlayed: null,
        image: definition.image || '',
        hashes: new Set(),
        characterIds: new Set(),
        variants: []
      });
    }

    const group = byName.get(name);
    const variant = formatEndgameVariant(item, definition);
    group.attempts += item.attempts;
    group.wins += item.wins || 0;
    group.clears += item.clears;
    group.kills += item.kills;
    group.deaths += item.deaths;
    group.assists += item.assists;
    group.opponentsDefeated += Number(item.opponentsDefeated || 0);
    group.seconds += item.seconds;
    group.soloClears += item.soloClears;
    group.soloFlawlessClears += item.soloFlawlessClears;
    group.hashes.add(item.hash);
    group.activityMode = group.activityMode || item.activityMode || 0;
    for (const id of item.activityModes || []) group.activityModes.add(id);
    for (const characterId of item.characters) group.characterIds.add(characterId);
    group.variants.push(variant);
    if (!group.image && definition.image) group.image = definition.image;
    if (item.bestSeconds != null && (group.bestSeconds == null || item.bestSeconds < group.bestSeconds)) {
      group.bestSeconds = item.bestSeconds;
    }
    if (item.lastPlayed && (!group.lastPlayed || new Date(item.lastPlayed) > new Date(group.lastPlayed))) {
      group.lastPlayed = item.lastPlayed;
    }
  }

  const activities = Array.from(byName.values())
    .map((item) => formatEndgameActivity(item))
    .sort((a, b) => b.clears.value - a.clears.value || b.attempts.value - a.attempts.value || a.name.localeCompare(b.name, 'zh-CN'));

  const rawTotal = activities.reduce(
    (total, item) => {
      total.attempts += item.attempts.value;
      total.wins += item.wins.value;
      total.clears += item.clears.value;
      total.kills += item.kills.value;
      total.deaths += item.deaths.value;
      total.assists += item.assists.value;
      total.opponentsDefeated += item.opponentsDefeated.value;
      total.seconds += item.seconds.value;
      return total;
    },
    { attempts: 0, wins: 0, clears: 0, kills: 0, deaths: 0, assists: 0, opponentsDefeated: 0, seconds: 0 }
  );

  const result = {
    total: formatEndgameTotal(rawTotal),
    activities
  };
  if (modeName === 'pvp') {
    result.subModes = buildPvpSubModes(hashGroups);
  }
  return result;
}

function buildPvpSubModes(hashGroups) {
  const groups = new Map();
  for (const item of hashGroups.values()) {
    const modeId = Number(item.activityMode || 0);
    const key = String(modeId || 'unknown');
    if (!groups.has(key)) {
      groups.set(key, {
        modeId,
        label: pvpModeLabel(modeId),
        attempts: 0,
        wins: 0,
        clears: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        opponentsDefeated: 0,
        seconds: 0,
        lastPlayed: null
      });
    }
    const group = groups.get(key);
    group.attempts += item.attempts;
    group.wins += item.wins || 0;
    group.clears += item.clears;
    group.kills += item.kills;
    group.deaths += item.deaths;
    group.assists += item.assists;
    group.opponentsDefeated += Number(item.opponentsDefeated || 0);
    group.seconds += item.seconds;
    if (item.lastPlayed && (!group.lastPlayed || new Date(item.lastPlayed) > new Date(group.lastPlayed))) {
      group.lastPlayed = item.lastPlayed;
    }
  }

  return Array.from(groups.values())
    .map((item) => ({
      modeId: item.modeId,
      label: item.label,
      lastPlayed: item.lastPlayed,
      ...formatEndgameTotal(item)
    }))
    .sort((a, b) => b.activitiesEntered.value - a.activitiesEntered.value || pvpModeSortWeight(a.modeId) - pvpModeSortWeight(b.modeId) || a.label.localeCompare(b.label, 'zh-CN'));
}

function pvpModeLabel(modeId) {
  const labels = {
    5: 'PvP 全部',
    10: '控制',
    12: '冲突',
    19: '铁旗',
    25: '狂欢',
    31: '霸权',
    32: '私人比赛',
    37: '生存',
    38: '倒计时',
    39: '九人试炼',
    43: '铁旗控制',
    44: '铁旗冲突',
    45: '铁旗霸权',
    48: '混战',
    50: '双打',
    59: '决胜',
    60: '封锁',
    61: '灼烧',
    62: '团队灼烧',
    69: '竞技',
    70: '快速比赛',
    71: '快速冲突',
    72: '竞技冲突',
    73: '快速控制',
    74: '竞技控制',
    80: '淘汰',
    81: '动能控制',
    84: '奥西里斯试炼',
    88: '裂隙',
    89: '区域控制',
    90: '铁旗裂隙',
    91: '铁旗区域控制',
    92: '遗物'
  };
  return labels[Number(modeId)] || `PvP 模式 ${modeId || '-'}`;
}

function pvpModeSortWeight(modeId) {
  const weights = {
    84: 1,
    19: 2,
    43: 3,
    90: 4,
    91: 5,
    69: 10,
    70: 20
  };
  return weights[Number(modeId)] || 100;
}

function formatEndgameActivity(item) {
  const base = formatEndgameTotal(item);
  const variants = item.variants
    .sort((a, b) => b.clears.value - a.clears.value || b.attempts.value - a.attempts.value || a.name.localeCompare(b.name, 'zh-CN'));
  return {
    name: item.name,
    mode: item.mode,
    activityMode: item.activityMode || 0,
    modeLabel: pvpModeLabel(item.activityMode),
    activityModes: Array.from(item.activityModes || []),
    image: item.image,
    variantCount: item.hashes.size,
    variants,
    characterCount: item.characterIds.size,
    lastPlayed: item.lastPlayed,
    bestSeconds: item.bestSeconds == null ? null : numberStat(item.bestSeconds),
    bestTime: item.bestSeconds == null ? null : secondsDisplayStat(item.bestSeconds),
    ...base
  };
}

function formatEndgameVariant(item, definition) {
  const base = formatEndgameTotal(item);
  return {
    hash: item.hash,
    activityMode: item.activityMode || 0,
    modeLabel: pvpModeLabel(item.activityMode),
    activityModes: Array.from(item.activityModes || []),
    name: cleanText(definition.name) || `活动 ${item.hash}`,
    image: definition.image || '',
    lastPlayed: item.lastPlayed,
    bestSeconds: item.bestSeconds == null ? null : numberStat(item.bestSeconds),
    bestTime: item.bestSeconds == null ? null : secondsDisplayStat(item.bestSeconds),
    ...base
  };
}

function definitionForEndgameItem(item, definitions) {
  const candidates = item.definitionHashes?.size ? [...item.definitionHashes] : [item.hash];
  for (const hash of candidates) {
    const definition = definitions.get(String(hash));
    if (isValidActivityDefinition(definition)) return definition;
  }
  return definitions.get(item.hash) || {};
}

function isValidActivityDefinition(definition) {
  if (!definition) return false;
  const name = cleanText(definition.name);
  if (!name || /^活动\s+\d+$/u.test(name) || /^Activity\s+\d+$/iu.test(name)) return false;
  return true;
}

function formatEndgameTotal(item) {
  const attempts = Number(item.attempts || 0);
  const clears = Number(item.clears || 0);
  const wins = Number(item.wins || 0);
  const kills = Number(item.kills || 0);
  const deaths = Number(item.deaths || 0);
  const assists = Number(item.assists || 0);
  const seconds = Number(item.seconds || 0);
  const soloClears = Number(item.soloClears || 0);
  const soloFlawlessClears = Number(item.soloFlawlessClears || 0);
  return {
    activitiesEntered: numberStat(attempts),
    attempts: numberStat(attempts),
    wins: numberStat(wins),
    activitiesWon: numberStat(wins),
    clears: numberStat(clears),
    activitiesCleared: numberStat(clears),
    kills: numberStat(kills),
    deaths: numberStat(deaths),
    assists: numberStat(assists),
    opponentsDefeated: numberStat(Number(item.opponentsDefeated || 0)),
    soloClears: numberStat(soloClears),
    soloFlawlessClears: numberStat(soloFlawlessClears),
    secondsPlayed: secondsDisplayStat(seconds),
    seconds: numberStat(seconds),
    hours: decimalStat(seconds / 3600, 1),
    kd: ratioStat(kills, deaths),
    kda: ratioStat(kills + assists / 2, deaths),
    efficiency: ratioStat(kills + assists, deaths),
    winRate: percentStat(numberStat(wins), numberStat(attempts)),
    completionRate: percentStat(numberStat(clears), numberStat(attempts))
  };
}

function normalizeEndgameActivityName(name) {
  return cleanText(name)
    .replace(/:\s*(标准|普通|大师|传说|英雄|自定义)$/u, '')
    .replace(/\s+\((标准|普通|大师|传说|英雄|自定义)\)$/u, '');
}

function statValue(entry) {
  const value = Number(entry?.basic?.value ?? entry?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function findModeBucket(results, names) {
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

function normalizeStatModeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickEndgameStats(bucket) {
  const base = pickStats(bucket);
  const clears = base.activitiesCleared || base.activitiesWon;
  return {
    ...base,
    clears,
    completionRate: percentStat(clears, base.activitiesEntered)
  };
}

function pickStats(bucket) {
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

function percentStat(numerator, denominator) {
  const top = Number(numerator?.value);
  const bottom = Number(denominator?.value);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return null;
  const value = (top / bottom) * 100;
  return {
    value,
    displayValue: `${value.toFixed(1)}%`
  };
}

function numberStat(value) {
  const number = Number(value || 0);
  return {
    value: number,
    displayValue: new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(number)
  };
}

function decimalStat(value, digits = 2) {
  const number = Number(value || 0);
  return {
    value: number,
    displayValue: new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(number)
  };
}

function ratioStat(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (bottom <= 0) return top > 0 ? decimalStat(top, 2) : null;
  return decimalStat(top / bottom, 2);
}

function secondsDisplayStat(seconds) {
  const value = Number(seconds || 0);
  if (!value) return { value: 0, displayValue: '-' };
  const hours = value / 3600;
  if (hours >= 1) return { value, displayValue: `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(hours)} 小时` };
  const minutes = Math.round(value / 60);
  return { value, displayValue: `${minutes} 分钟` };
}

function stat(bucket, key) {
  const entry = bucket?.[key];
  if (!entry?.basic) return null;
  return {
    value: entry.basic.value,
    displayValue: entry.basic.displayValue
  };
}

function displayMembershipName(item) {
  if (item.bungieGlobalDisplayName) {
    return `${item.bungieGlobalDisplayName}#${String(item.bungieGlobalDisplayNameCode || '').padStart(4, '0')}`;
  }
  if (item.displayNameCode) return `${item.displayName}#${item.displayNameCode}`;
  return item.displayName || item.membershipId;
}

function normalizePlayerSearchResult(item) {
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

function bungieAssetUrl(pathname) {
  const path = cleanText(pathname);
  if (!path) return '';
  return path.startsWith('http') ? path : `https://www.bungie.net${path.startsWith('/') ? path : `/${path}`}`;
}

function membershipTypeName(type) {
  const map = {
    '-1': '全部',
    1: 'Xbox',
    2: 'PlayStation',
    3: 'Steam',
    4: 'Battle.net',
    5: 'Stadia',
    6: 'Epic',
    10: 'Demon'
  };
  return map[type] || `平台 ${type}`;
}

function className(type) {
  return ['泰坦', '猎人', '术士'][Number(type)] || '未知职业';
}

function raceName(type) {
  return ['人类', '觉醒者', 'EXO'][Number(type)] || '未知种族';
}

function genderName(type) {
  return ['男性', '女性'][Number(type)] || '未知';
}

function parseTime(value) {
  if (!value) return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const number = Number(value);
    if (number > 1_000_000_000_000) return new Date(number).toISOString();
    if (number > 1_000_000_000) return new Date(number * 1000).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function extractDestinyName(text) {
  const normalized = cleanText(String(text || '').replace(/^\/j\s+/i, ''));
  const strict = normalized.match(/(?:^|[\s:：,，;；])([A-Za-z0-9_\-.()[\]\u4e00-\u9fff ]{1,32}#\d{3,8})(?=$|[\s,，;；])/u);
  if (strict?.[1]) return strict[1].trim();
  const loose = normalized.match(/([^\s#,:：，;；]{1,32}#\d{3,8})/u);
  return loose?.[1]?.trim() || '';
}

function stableId(title, content, index) {
  const seed = `${title}|${content}|${index}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `item-${hash.toString(36)}`;
}

function tryParseJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parseJsonEnv(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(500, 'INVALID_ENV_JSON', 'HEYBOX_SOURCE_HEADERS must be valid JSON');
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
