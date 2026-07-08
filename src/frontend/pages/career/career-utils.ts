import type {
  CareerSummaryDto,
  CraftingItemDto,
  CraftingSeasonGroupDto,
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



const CRAFTING_SEASON_ORDER: Record<string, number> = {

  '篇章：异端': 128,

  '篇章：回响': 124,

  '赛季：怨魂': 122,

  '终愿赛季': 118,

  '侠盗赛季': 114,

  '抗战赛季': 110,

  '深渊赛季': 106,

  '宿怨赛季': 102,

  '炽天使赛季': 98,

  '苏生赛季': 94,

  '奇巫赛季': 90,

  '光陨之秋': 72,

  '邪姬魅影': 68,

  '凌光之刻': 64,

  '暗影之逆': 60,

  '经典赛季': 10,
  '其他赛季': 0
};

function craftingSeasonSortWeight(label: string) {
  if (CRAFTING_SEASON_ORDER[label] != null) return CRAFTING_SEASON_ORDER[label];
  if (label.startsWith('篇章：')) return 120;
  if (label.endsWith('赛季')) return 80;
  if (label.includes('战役')) return 70;
  return 20;
}

function sortCraftingItems(a: CraftingItemDto, b: CraftingItemDto) {
  return (
    Number(isCraftingPatternComplete(a)) - Number(isCraftingPatternComplete(b)) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
  );
}

function craftingWatermarkKey(watermark?: string) {
  if (!watermark) return 'legacy';
  const file = watermark.split('/').pop() || watermark;
  return file.replace(/\.\w+$/i, '');
}

function resolveCraftingSeasonLabel(items: CraftingItemDto[]) {
  const sources = items.map((item) => craftingSourceLabel(item.source)).filter(Boolean);

  for (const source of sources) {
    const episode = source.match(/篇章[：:]\s*([^”"、\s活动]+)/);
    if (episode?.[1]) return `篇章：${episode[1].trim()}`;
  }

  for (const source of sources) {
    const season = source.match(/([\u4e00-\u9fa5A-Za-z·]{2,10})赛季/);
    if (season?.[1] && !['活动', '武器'].includes(season[1])) return `${season[1]}赛季`;
  }

  for (const source of sources) {
    if (source.includes('怨魂')) return '赛季：怨魂';
  }

  for (const source of sources) {
    if (source.includes('战役')) return source.split(/[。.]/)[0];
  }

  if (sources.some((source) => source.includes('季票'))) return '当季赛季';
  return '经典赛季';
}

export function resolveCraftingActivityLabel(source: unknown) {
  const text = craftingSourceLabel(source);
  const raid = text.match(/[“"]([^”"]+?)[”"]\s*突袭/);
  if (raid?.[1]) return `突袭 · ${raid[1]}`;
  const dungeon = text.match(/[“"]([^”"]+?)[”"]\s*地牢/);
  if (dungeon?.[1]) return `地牢 · ${dungeon[1]}`;
  const episode = text.match(/篇章[：:]\s*([^”"、活动]+)/);
  if (episode?.[1]) return `篇章活动 · ${episode[1].trim()}`;
  const season = text.match(/([\u4e00-\u9fa5A-Za-z·]{2,10})赛季(?:活动)?/);
  if (season?.[1]) return `赛季活动 · ${season[1]}`;
  if (text.includes('季票')) return '季票';
  if (text.includes('战役')) return text.split(/[。.]/)[0];
  if (text.includes('异域任务')) return text.slice(0, 22);
  if (text.includes('探索')) return text.split(/[。.]/)[0];
  return text.slice(0, 24) || '其他来源';
}

function resolveCraftingActivityKey(item: CraftingItemDto) {
  return `${item.sourceHash || 0}:${resolveCraftingActivityLabel(item.source)}`;
}

function buildCraftingSourceGroups(items: CraftingItemDto[]): CraftingSourceGroupDto[] {
  const buckets = new Map<string, CraftingItemDto[]>();
  for (const item of items) {
    const key = resolveCraftingActivityKey(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }

  return Array.from(buckets.entries())
    .map(([key, bucketItems]) => {
      const sortedItems = [...bucketItems].sort(sortCraftingItems);
      const complete = sortedItems.filter((item) => isCraftingPatternComplete(item)).length;
      return {
        key,
        source: resolveCraftingActivityLabel(sortedItems[0]?.source),
        items: sortedItems,
        complete,
        total: sortedItems.length
      };
    })
    .sort((a, b) => {
      const kindWeight = (label: string) => {
        if (label.startsWith('突袭')) return 0;
        if (label.startsWith('地牢')) return 1;
        if (label.startsWith('赛季活动')) return 2;
        if (label.startsWith('篇章活动')) return 3;
        if (label === '季票') return 4;
        return 5;
      };
      const kindDiff = kindWeight(a.source) - kindWeight(b.source);
      if (kindDiff) return kindDiff;
      return a.source.localeCompare(b.source, 'zh-CN');
    });
}

/** Group craftables by season (watermark), then raid / dungeon / activity source. */
export function buildCraftingGroups(items: CraftingItemDto[]): CraftingSeasonGroupDto[] {
  const seasonBuckets = new Map<string, CraftingItemDto[]>();
  for (const item of items) {
    const key = craftingWatermarkKey(String(item.watermark || ''));
    if (!seasonBuckets.has(key)) seasonBuckets.set(key, []);
    seasonBuckets.get(key)!.push(item);
  }

  const groups = Array.from(seasonBuckets.entries()).map(([key, bucketItems]) => {
    const season = resolveCraftingSeasonLabel(bucketItems);
    const sources = buildCraftingSourceGroups(bucketItems);
    const complete = sources.reduce((sum, group) => sum + group.complete, 0);
    return {
      key,
      season,
      sources,
      complete,
      total: bucketItems.length
    };
  });

  return groups.sort((a, b) => {
    const weightDiff = craftingSeasonSortWeight(b.season) - craftingSeasonSortWeight(a.season);
    if (weightDiff) return weightDiff;
    const completionDiff = (b.total ? b.complete / b.total : 0) - (a.total ? a.complete / a.total : 0);
    if (completionDiff) return completionDiff;
    return a.season.localeCompare(b.season, 'zh-CN');
  });
}



export function formatCraftingCount(value: unknown) {

  return formatNumber(value as number);

}


