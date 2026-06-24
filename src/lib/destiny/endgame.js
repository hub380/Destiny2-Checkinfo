import { cleanText } from '../utils/index.js';
import {
  normalizeEndgameActivityName,
  numberStat,
  percentStat,
  pvpModeLabel,
  statValue,
  bungieFetch
} from '../bungie/index.js';
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
import { getActivityDefinitions } from './activities.js';
import {
  decimalStat,
  ratioStat,
  secondsDisplayStat
} from './summary.js';
export async function getDestinyEndgame(body, env, ctx) {
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


export async function getEndgameCareer(membership, characters, modes = ['raid', 'dungeon'], env, ctx) {
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

export async function collectEndgameHistory(membership, characterId, modeName, mode, pageSize, pageLimit, output, warnings, env) {
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

export function addEndgameActivity(output, activity, characterId, modeName) {
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


export function buildEndgameMode(modeName, hashGroups, definitions) {
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

export function buildPvpSubModes(hashGroups) {
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


export function pvpModeSortWeight(modeId) {
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

export function formatEndgameActivity(item) {
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

export function formatEndgameVariant(item, definition) {
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

export function definitionForEndgameItem(item, definitions) {
  const candidates = item.definitionHashes?.size ? [...item.definitionHashes] : [item.hash];
  for (const hash of candidates) {
    const definition = definitions.get(String(hash));
    if (isValidActivityDefinition(definition)) return definition;
  }
  return definitions.get(item.hash) || {};
}

export function isValidActivityDefinition(definition) {
  if (!definition) return false;
  const name = cleanText(definition.name);
  if (!name || /^活动\s+\d+$/u.test(name) || /^Activity\s+\d+$/iu.test(name)) return false;
  return true;
}

export function formatEndgameTotal(item) {
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