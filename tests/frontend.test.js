import { describe, expect, it } from 'vitest';
import { mergeEndgameCareer } from '@frontend/lib/career-merge';
import { formatBungieName, formatSeconds, formatMinutes, statDisplay } from '@frontend/lib/format';
import { bungieNameSubmitHint, resolveBungieNameSubmit } from '@frontend/lib/player-search-submit';
import {
  buildCraftingGroups,
  craftingPatternLabel,
  isCraftingPatternComplete
} from '@frontend/pages/career/career-utils';
import { formatEndgameTotal } from '@lib/destiny/endgame-format.js';

describe('resolveBungieNameSubmit', () => {
  it('returns ready for full bungie names', async () => {
    const result = await resolveBungieNameSubmit('Guardian#1234', {
      refreshSuggestions: async () => [],
      setOpen: () => undefined
    });
    expect(result).toEqual({ status: 'ready', bungieName: 'Guardian#1234' });
  });

  it('returns empty for blank input', async () => {
    const result = await resolveBungieNameSubmit('  ', {
      refreshSuggestions: async () => [],
      setOpen: () => undefined
    });
    expect(result).toEqual({ status: 'empty' });
  });

  it('returns needs_pick when prefix matches players', async () => {
    let opened = false;
    const result = await resolveBungieNameSubmit('Guard', {
      refreshSuggestions: async () => [{ bungieName: 'Guard#0001' }],
      setOpen: (value) => {
        opened = value;
      }
    });
    expect(result.status).toBe('needs_pick');
    expect(opened).toBe(true);
  });

  it('builds submit hint for incomplete names', () => {
    expect(
      bungieNameSubmitHint('Guard', {
        suggestions: [{ bungieName: 'Guard#1' }],
        notice: '',
        setOpen: () => undefined,
        refreshSuggestions: async () => []
      })
    ).toBe('请选择一个完整的棒鸡名称后查询');
  });
});

describe('endgame format', () => {
  it('formats endgame totals with completion rate', () => {
    const total = formatEndgameTotal({ attempts: 10, clears: 4, kills: 100, deaths: 20, seconds: 3600 });
    expect(total.clears.value).toBe(4);
    expect(total.completionRate.displayValue).toContain('%');
  });
});

describe('statDisplay', () => {
  it('accepts stat objects and plain numbers', () => {
    expect(statDisplay({ value: 12, displayValue: '12' })).toBe('12');
    expect(statDisplay(42)).toBe('42');
    expect(statDisplay('-')).toBe('-');
  });
});

describe('career crafting utils', () => {
  it('groups crafting items by source and completion', () => {
    const groups = buildCraftingGroups([
      { hash: '1', name: 'A', source: '来源: 测试', unlocked: true },
      { hash: '2', name: 'B', source: '来源: 测试', unlocked: false, pattern: { label: '0/1', percent: 0 } }
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].total).toBe(2);
    expect(groups[0].complete).toBe(1);
    expect(isCraftingPatternComplete({ unlocked: true })).toBe(true);
    expect(craftingPatternLabel({ unlocked: true, pattern: { label: '-' } })).toBe('1/1');
  });
});

describe('format helpers', () => {
  it('formatBungieName pads display code', () => {
    expect(formatBungieName('Guardian', 42)).toBe('Guardian#0042');
    expect(formatBungieName('Guardian', 42, 'Custom#9999')).toBe('Custom#9999');
  });

  it('formatSeconds renders minutes or hours', () => {
    expect(formatSeconds(90)).toBe('2 分钟');
    expect(formatSeconds(7200)).toBe('2.0 小时');
    expect(formatSeconds(0)).toBe('-');
  });

  it('formatMinutes converts minutes to hours', () => {
    expect(formatMinutes(60)).toBe('1 小时');
  });
});

describe('mergeEndgameCareer', () => {
  it('merges endgame payload and clears loading flag', () => {
    const career = {
      account: { displayName: 'Test' },
      stats: {},
      endgameLoading: { raid: true, dungeon: true, pvp: false }
    };
    const merged = mergeEndgameCareer(career, {
      endgame: { raid: { total: { clears: { value: 10 } } } },
      statsPatch: { raid: { clears: { value: 10 } } },
      cache: { endgame: 'hit' }
    }, 'raid');
    expect(merged.endgame?.raid).toBeDefined();
    expect(merged.stats?.raid).toBeDefined();
    expect(merged.endgameLoading).toEqual({ raid: false, dungeon: true, pvp: false });
    expect(merged.cache?.endgame).toBe('hit');
  });
});
