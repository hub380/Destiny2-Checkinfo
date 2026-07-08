import type {
  CareerSummaryDto,
  CraftingItemDto,
  CraftingSourceGroupDto,
  EndgameStatBlockDto
} from '@frontend/lib/types';

import { formatNumber } from '@frontend/lib/format';



export function isEndgameModeLoading(career: CareerSummaryDto, mode: string) {

  if (!career.endgameLoading) return false;

  if (career.endgameLoading === true) return !career.endgame?.[mode];

  return Boolean(career.endgameLoading[mode]);

}



/** Prefer full endgame block when loaded; otherwise fall back to summary stats. */

export function resolveEndgameMode(career: CareerSummaryDto, mode: 'raid' | 'dungeon' | 'pvp') {

  const summary = (career.stats?.[mode] || {}) as EndgameStatBlockDto;

  const full = career.endgame?.[mode] as EndgameStatBlockDto | undefined;

  if (full?.activities?.length) return full;

  if (full?.total && hasEndgameTotals(full.total)) return full;

  if (hasEndgameTotals(summary)) return summary;

  if (full) return { ...summary, ...full, total: full.total || summary.total || summary };

  return summary;

}



function hasEndgameTotals(block: Record<string, unknown> | undefined | null) {

  if (!block || typeof block !== 'object') return false;

  const total = (block as { total?: Record<string, unknown> }).total || block;

  return ['clears', 'activitiesEntered', 'attempts', 'activitiesCleared'].some((key) => {

    const value = (total as Record<string, unknown>)[key];

    if (value == null) return false;

    if (typeof value === 'object' && value !== null && 'value' in value) return (value as { value: unknown }).value != null;

    return true;

  });

}



export function loadingText(loading?: boolean) {

  return loading ? '加载中' : '-';

}



export function craftingSourceLabel(value: unknown) {

  const source = String(value || '').replace(/^来源[:：]\s*/i, '').trim();

  return source || '其他来源';

}



export function craftingPatternLabel(item: CraftingItemDto) {

  if (item.pattern?.label && item.pattern.label !== '-') return item.pattern.label;

  if (item.unlocked) return '1/1';

  return '-';

}



export function craftingPatternPercent(item: CraftingItemDto) {

  const percent = Number(item.pattern?.percent);

  if (Number.isFinite(percent)) return percent;

  return item.unlocked ? 100 : 0;

}



export function isCraftingPatternComplete(item: CraftingItemDto) {

  if (typeof item.pattern?.complete === 'boolean') return item.pattern.complete;

  return Boolean(item.unlocked);

}



function sortCraftingItems(a: CraftingItemDto, b: CraftingItemDto) {
  return (
    Number(isCraftingPatternComplete(a)) - Number(isCraftingPatternComplete(b)) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
  );
}

export function buildCraftingGroups(items: CraftingItemDto[]): CraftingSourceGroupDto[] {
  const groups = new Map<string, CraftingSourceGroupDto>();
  for (const item of items) {
    const source = craftingSourceLabel(item.source);
    const key = `${item.sourceHash || source}`;
    if (!groups.has(key)) groups.set(key, { key, source, items: [], complete: 0, total: 0 });
    const group = groups.get(key)!;
    group.items.push(item);
    if (isCraftingPatternComplete(item)) group.complete += 1;
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      total: group.items.length,
      items: group.items.sort(sortCraftingItems)
    }))
    .sort((a, b) => {
      const aDone = a.total ? a.complete / a.total : 0;
      const bDone = b.total ? b.complete / b.total : 0;
      return aDone - bDone || a.source.localeCompare(b.source, 'zh-CN');
    });
}



export function formatCraftingCount(value: unknown) {

  return formatNumber(value as number);

}

