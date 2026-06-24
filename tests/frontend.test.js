import { describe, expect, it } from 'vitest';
import { mergeEndgameCareer } from '@frontend/lib/career-merge';
import { formatBungieName, formatSeconds, formatMinutes } from '@frontend/lib/format';

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
