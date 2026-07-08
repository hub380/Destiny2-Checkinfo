import { describe, expect, it } from 'vitest';
import { extractDestinyName, parseBungieName, parseJsonEnv } from '@lib/utils/index.js';
import { mapHeyboxTeam, normalizeHeyboxHomePayload, parseHeyboxSlots } from '@lib/integrations/index.js';
import { selectMembership, formatEndgameTotal, normalizeEndgameActivityName, pvpModeLabel } from '@lib/bungie/index.js';

describe('text-utils', () => {
  it('extracts destiny names from text', () => {
    expect(extractDestinyName('缺1 /j GuardianCN#2333 宗师')).toBe('GuardianCN#2333');
    expect(extractDestinyName('无用户名')).toBe('');
  });

  it('parses bungie names', () => {
    expect(parseBungieName('Guardian#2333')).toEqual({ displayName: 'Guardian', displayNameCode: 2333 });
    expect(parseBungieName('bad')).toBeNull();
  });

  it('preserves consecutive spaces inside bungie display names', () => {
    expect(parseBungieName(' MIИAMI  Yume#5360 ')).toEqual({
      displayName: 'MIИAMI  Yume',
      displayNameCode: 5360
    });
    expect(parseBungieName('MIИAMI\u00A0\u00A0Yume#5360')).toEqual({
      displayName: 'MIИAMI  Yume',
      displayNameCode: 5360
    });
  });
});

describe('heybox-parser', () => {
  it('maps heybox team rows', () => {
    const item = mapHeyboxTeam(
      {
        content_text: '救赎边缘 3/6 缺治疗',
        game_id: 'Captain#1024',
        tags: [{ desc: 'Raid' }],
        user: { username: '队长', avatar: 'https://img.example/a.png' },
        link_id: 'abc',
        remain_seconds: 120
      },
      0,
      'https://api.example'
    );
    expect(item.username).toBe('Captain#1024');
    expect(item.joinCommand).toBe('/j Captain#1024');
    expect(item.slots).toEqual({ current: 3, max: 6 });
  });

  it('normalizes payload list', () => {
    const items = normalizeHeyboxHomePayload({
      result: {
        team_list: [
          { content_text: '测试', game_id: 'A#1234', is_room_delete: false, remain_seconds: 10 },
          { is_room_delete: true }
        ]
      }
    }, 'https://api.example');
    expect(items.length).toBe(1);
    expect(items[0].username).toBe('A#1234');
  });

  it('parses slot patterns', () => {
    expect(parseHeyboxSlots('2=4')).toEqual({ current: 2, max: 6 });
    expect(parseHeyboxSlots('3/6')).toEqual({ current: 3, max: 6 });
  });
});

describe('bungie-utils', () => {
  it('prefers cross-save membership', () => {
    const memberships = [
      { membershipType: 3, membershipId: '1', crossSaveOverride: 0 },
      { membershipType: 6, membershipId: '2', crossSaveOverride: 6 }
    ];
    expect(selectMembership(memberships).membershipId).toBe('2');
  });
});

describe('env-utils', () => {
  it('parses json env values', () => {
    expect(parseJsonEnv('{"a":1}', {})).toEqual({ a: 1 });
    expect(parseJsonEnv('', { fallback: true })).toEqual({ fallback: true });
  });
});

describe('stats-format', () => {
  it('normalizes endgame activity names', () => {
    expect(normalizeEndgameActivityName('救赎边缘: 标准')).toBe('救赎边缘');
    expect(normalizeEndgameActivityName('深岩墓穴 (大师)')).toBe('深岩墓穴');
  });

  it('formats endgame totals', () => {
    const total = formatEndgameTotal({ attempts: 10, clears: 4, kills: 100, deaths: 20, seconds: 3600 });
    expect(total.clears.value).toBe(4);
    expect(total.completionRate?.displayValue).toBe('40.0%');
  });

  it('labels pvp modes', () => {
    expect(pvpModeLabel(25)).toBe('狂欢');
  });
});
