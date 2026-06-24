import type { JsonRecord } from '@frontend/lib/types';

export function gearMeta(item: JsonRecord) {
  if (item.kind === 'weapon') return [item.type, item.ammo, item.element, item.tier, item.adept ? '专家' : ''].filter(Boolean);
  if (item.kind === 'armor') return [item.slot, item.className, item.tier, item.type].filter(Boolean);
  if (item.kind === 'perk') return [item.enhanced ? '强化 Perk' : '普通 Perk', item.type, '点击反查武器'].filter(Boolean);
  return [item.type].filter(Boolean);
}

export function primarySourceLabel(item: JsonRecord) {
  const hints = Array.isArray(item.sourceHints) ? item.sourceHints : [];
  const first = hints.find((hint) => hint?.text);
  return first?.text || item.source || '';
}

export function gearKindLabel(kind: string) {
  const labels: Record<string, string> = { weapon: '武器', armor: '护甲', perk: 'Perk', all: '全部' };
  return labels[kind] || '装备';
}

export function sourceKindLabel(kind?: string) {
  const labels: Record<string, string> = {
    crafting: '锻造配方',
    collectible: '收藏品来源',
    displaySource: '物品来源',
    rewardSource: '奖励来源',
    vendor: 'Vendor 来源'
  };
  return labels[String(kind || '')] || '来源提示';
}

export function perkTypeLabel(perk: JsonRecord) {
  if (Array.isArray(perk.enhancedOptions) && perk.enhancedOptions.length) return `${perk.type || '普通'} / 可强化`;
  return perk.enhanced ? '强化' : perk.type || '普通';
}

export function enhancedLines(option: JsonRecord) {
  const statText = formatEnhancedStatDiff(option.statDiff || []);
  const description = option.descriptionDiff || '';
  const lines = [];
  if (statText) lines.push(`强化后：${statText}`);
  if (!statText && description) lines.push(`强化后：${description}`);
  if (statText && description) lines.push(`强化说明：${description}`);
  return lines;
}

export function formatEnhancedStatDiff(stats: JsonRecord[]) {
  return stats.map((stat) => {
    const enhanced = signedNumber(stat.enhanced);
    const delta = signedNumber(stat.delta);
    const condition = stat.conditionallyActive ? '，条件触发' : '';
    if (Number(stat.normal || 0) === 0) return `${stat.name} ${enhanced}${condition}`;
    return `${stat.name} ${enhanced}（${delta}）${condition}`;
  }).join('、');
}

export function signedNumber(value: unknown) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}
