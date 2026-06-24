export function normalizeEndgameActivityName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/:\s*(标准|普通|大师|传说|英雄|自定义)$/u, '')
    .replace(/\s+\((标准|普通|大师|传说|英雄|自定义)\)$/u, '');
}

export function statValue(entry) {
  const value = Number(entry?.basic?.value ?? entry?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function numberStat(value) {
  const number = Number(value || 0);
  return {
    value: number,
    displayValue: new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(number)
  };
}

export function percentStat(numerator, denominator) {
  const top = Number(numerator?.value);
  const bottom = Number(denominator?.value);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return null;
  const value = (top / bottom) * 100;
  return {
    value,
    displayValue: `${value.toFixed(1)}%`
  };
}

export function formatEndgameTotal(item) {
  const attempts = Number(item.attempts || 0);
  const clears = Number(item.clears || 0);
  const kills = Number(item.kills || 0);
  const deaths = Number(item.deaths || 0);
  const seconds = Number(item.seconds || 0);
  const soloClears = Number(item.soloClears || 0);
  const soloFlawlessClears = Number(item.soloFlawlessClears || 0);
  return {
    activitiesEntered: numberStat(attempts),
    attempts: numberStat(attempts),
    clears: numberStat(clears),
    activitiesCleared: numberStat(clears),
    kills: numberStat(kills),
    deaths: numberStat(deaths),
    assists: numberStat(Number(item.assists || 0)),
    soloClears: numberStat(soloClears),
    soloFlawlessClears: numberStat(soloFlawlessClears),
    seconds: numberStat(seconds),
    completionRate: percentStat(numberStat(clears), numberStat(attempts))
  };
}

export function pvpModeLabel(modeId) {
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
