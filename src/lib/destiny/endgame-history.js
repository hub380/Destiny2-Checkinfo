import {
  statValue,
  bungieFetch
} from '../bungie/index.js';
import {
  historyPageLimit,
  historyPageSize,
  normalizeEndgameModes
} from './shared.js';
import { getActivityDefinitions } from './activities.js';
import { buildEndgameMode } from './endgame-format.js';

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
    let payload;
    try {
      payload = await bungieFetch(
        `/Platform/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Character/${characterId}/Stats/Activities/?mode=${mode}&count=${pageSize}&page=${page}`,
        { method: 'GET' },
        env
      );
    } catch (error) {
      if (isPrivateActivityHistoryError(error)) {
        warnings.push(`${modeName}:${characterId} activity history is private`);
        return;
      }
      throw error;
    }
    const activities = Array.isArray(payload.Response?.activities) ? payload.Response.activities : [];
    for (const activity of activities) {
      addEndgameActivity(output, activity, characterId, modeName);
    }
    if (activities.length < pageSize) return;
  }

  warnings.push(`${modeName}:${characterId} reached page limit ${pageLimit}`);
}

export function isPrivateActivityHistoryError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'BUNGIE_API_ERROR' && (
    message.includes('private') ||
    message.includes('no peeking') ||
    message.includes('chosen for this data to be private')
  );
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
