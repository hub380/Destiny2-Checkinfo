import { httpError } from '../http/index.js';
import { getWorkerCachedJson, endgameCacheTtlSeconds } from '../cache/index.js';
import { CACHE_VERSION } from '../shared/index.js';
import {
  buildEndgameStatsPatch,
  historyPageLimit,
  historyPageSize,
  normalizeEndgameModes
} from './shared.js';
import { resolveEndgameTarget } from './targets.js';
import { getPublicCareerSummaryByMembership } from './summary.js';
import { getEndgameCareer } from './endgame-history.js';
import { buildEndgameModeFromStats } from './endgame-format.js';

export {
  getEndgameCareer,
  collectEndgameHistory,
  addEndgameActivity
} from './endgame-history.js';

export {
  buildEndgameMode,
  buildPvpSubModes,
  pvpModeSortWeight,
  formatEndgameActivity,
  formatEndgameVariant,
  definitionForEndgameItem,
  isValidActivityDefinition,
  formatEndgameTotal,
  buildEndgameModeFromStats
} from './endgame-format.js';

function wantsFullEndgameHistory(body) {
  if (body?.fullHistory === false || body?.summaryOnly === true) return false;
  return true;
}

export async function getDestinyEndgame(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const target = await resolveEndgameTarget(body, env, ctx);
  const modes = normalizeEndgameModes(body?.modes || body?.mode);

  if (!wantsFullEndgameHistory(body)) {
    const summary = await getPublicCareerSummaryByMembership(target.membership, env, ctx);
    const stats = summary.stats || {};
    const endgame = Object.fromEntries(modes.map((mode) => [mode, buildEndgameModeFromStats(mode, stats[mode] || {})]));
    return {
      updatedAt: new Date().toISOString(),
      account: {
        membershipType: target.membership.membershipType,
        membershipId: target.membership.membershipId
      },
      endgame,
      statsPatch: buildEndgameStatsPatch(endgame),
      cache: {
        endgame: 'summary-only',
        ...(summary.cache || {})
      }
    };
  }

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
