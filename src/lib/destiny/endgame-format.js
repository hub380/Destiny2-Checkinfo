import { cleanText } from '../utils/index.js';
import {
  normalizeEndgameActivityName,
  numberStat,
  percentStat,
  pvpModeLabel,
  statValue
} from '../bungie/index.js';
import { decimalStat, ratioStat, secondsDisplayStat } from './summary-stats.js';

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

/** Build endgame block from Bungie aggregate stats (no activity history pagination). */
export function buildEndgameModeFromStats(modeName, statsBlock = {}) {
  const attempts = statValue(statsBlock.activitiesEntered ?? statsBlock.activitiesPlayed ?? statsBlock.attempts);
  const clears = statValue(statsBlock.activitiesCleared ?? statsBlock.clears);
  const wins = statValue(statsBlock.activitiesWon ?? statsBlock.wins);
  const kills = statValue(statsBlock.kills);
  const deaths = statValue(statsBlock.deaths);
  const assists = statValue(statsBlock.assists);
  const seconds = statValue(statsBlock.secondsPlayed ?? statsBlock.seconds);
  const result = {
    total: formatEndgameTotal({ attempts, clears, wins, kills, deaths, assists, seconds }),
    activities: [],
    summaryOnly: true
  };
  if (modeName === 'pvp' && Array.isArray(statsBlock.modes)) {
    result.subModes = statsBlock.modes.map((entry) => ({
      modeId: entry.mode || entry.activityMode || 0,
      label: pvpModeLabel(entry.mode || entry.activityMode || 0),
      ...formatEndgameTotal({
        attempts: statValue(entry.count ?? entry.activitiesEntered),
        wins: statValue(entry.activitiesWon),
        clears: statValue(entry.activitiesCleared),
        kills: statValue(entry.kills),
        deaths: statValue(entry.deaths),
        assists: statValue(entry.assists),
        seconds: statValue(entry.secondsPlayed)
      })
    }));
  }
  return result;
}
