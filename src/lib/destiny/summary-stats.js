import { percentStat } from '../bungie/index.js';

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
