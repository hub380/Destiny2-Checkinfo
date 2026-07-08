import { cleanText, mapWithConcurrency, parseTime } from '../utils/index.js';
import { httpError, positiveNumber } from '../http/index.js';
import { bungieFetch } from '../bungie/index.js';
import { getDestinySummary, getPublicCareerSummaryByMembership } from './summary.js';
import { getDestinyEndgame } from './endgame.js';
import { normalizeEndgameModes } from './shared.js';
import { resolveActivityDefinition, fallbackActivityDefinition } from './activities.js';
export async function getDestinyFireteam(body, env, ctx) {
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
