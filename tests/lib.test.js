import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractDestinyName, parseBungieName, parseJsonEnv } from '@lib/utils/index.js';
import { mapHeyboxTeam, normalizeHeyboxHomePayload, parseHeyboxSlots } from '@lib/integrations/index.js';
import { selectMembership, formatEndgameTotal, normalizeEndgameActivityName, pvpModeLabel } from '@lib/bungie/index.js';
import { buildGearIndex } from '@lib/gear/index.js';
import { makeSearchText, simplifiedChineseAlias } from '@lib/gear/labels.js';
import { mergePerks } from '@lib/gear/split-writer.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(item.joinCommand).toBe('/加入 Captain#1024');
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

  it('uses crossSaveOverride as the active membership type when another row points to it', () => {
    const memberships = [
      { membershipType: 3, membershipId: 'steam', crossSaveOverride: 0 },
      { membershipType: 6, membershipId: 'epic-empty', crossSaveOverride: 3 }
    ];
    expect(selectMembership(memberships).membershipId).toBe('steam');
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

describe('gear multilingual search', () => {
  it('derives simplified Chinese aliases from traditional Chinese names', () => {
    expect(simplifiedChineseAlias('\u8a98\u990c\u5207\u63db')).toBe('\u8bf1\u9975\u5207\u6362');
    expect(simplifiedChineseAlias('\u707d\u8b8a')).toBe('\u707e\u53d8');
  });

  it('includes simplified aliases derived from traditional names in search text', () => {
    const searchText = makeSearchText({
      name: '\u8bf1\u5bfc\u63a8\u9500',
      enName: 'Bait and Switch',
      chtName: '\u8a98\u990c\u5207\u63db',
      hash: 200
    });
    expect(searchText).toContain('bait and switch');
    expect(searchText).toContain('\u8a98\u990c\u5207\u63db');
    expect(searchText).toContain('\u8bf1\u9975\u5207\u6362');
  });

  it('includes temporary English and traditional Chinese names in search text', () => {
    const searchText = makeSearchText({
      name: '灾变',
      enName: 'Cataclysmic',
      chtName: '災變',
      weaponType: '线性融合步枪',
      hash: 999
    });
    expect(searchText).toContain('cataclysmic');
    expect(searchText).toContain('災變');
  });

  it('adds multilingual names to searchText without keeping temporary fields', async () => {
    const responses = new Map([
      ['/Platform/Destiny2/Manifest/', {
        Response: {
          version: 'manifest-test',
          jsonWorldComponentContentPaths: {
            'zh-chs': {
              DestinyInventoryItemDefinition: '/zh-items.json',
              DestinyPlugSetDefinition: '/plug-sets.json'
            },
            en: {
              DestinyInventoryItemDefinition: '/en-items.json'
            },
            'zh-cht': {
              DestinyInventoryItemDefinition: '/cht-items.json'
            }
          }
        }
      }],
      ['/zh-items.json', {
        100: {
          hash: 100,
          itemType: 3,
          itemCategoryHashes: [1, 2],
          displayProperties: { name: '灾变', description: '描述', icon: '/weapon.png' },
          itemTypeDisplayName: '线性融合步枪',
          inventory: { tierTypeName: '传说' },
          damageTypeHashes: [],
          sockets: { socketEntries: [{ reusablePlugItems: [{ plugItemHash: 200 }] }] }
        },
        200: {
          hash: 200,
          displayProperties: { name: '\u8bf1\u5bfc\u63a8\u9500', description: 'perk description', icon: '/perk.png' },
          itemTypeDisplayName: 'Trait',
          plug: { plugCategoryIdentifier: 'trait' },
          investmentStats: []
        }
      }],
      ['/en-items.json', {
        100: { displayProperties: { name: 'Cataclysmic' } },
        200: { displayProperties: { name: 'Bait and Switch' } }
      }],
      ['/cht-items.json', {
        100: { displayProperties: { name: '災變' } }
        ,200: { displayProperties: { name: '\u8a98\u5c0e\u63a8\u92b7' } }
      }],
      ['/plug-sets.json', {}]
    ]);
    vi.stubGlobal('fetch', async (url) => {
      const parsed = new URL(String(url));
      const payload = responses.get(parsed.pathname);
      if (!payload) throw new Error(`Unexpected URL ${parsed.pathname}`);
      return new Response(JSON.stringify(payload), { status: 200 });
    });

    const index = await buildGearIndex({ apiKey: 'test-key', locale: 'zh-chs' });
    const item = index.items.find((entry) => entry.hash === 100);
    const perk = index.items.find((entry) => entry.hash === 200);
    const weaponPlug = index.weaponPlugs.find((entry) => entry.hash === 200);
    const mergedPerk = mergePerks(index).find((entry) => entry.hash === 200);

    expect(item.searchText).toContain('cataclysmic');
    expect(item.searchText).toContain('災變');
    expect(item).not.toHaveProperty('enName');
    expect(item).not.toHaveProperty('chtName');
    expect(perk.searchText).toContain('bait and switch');
    expect(weaponPlug.searchText).toContain('bait and switch');
    expect(weaponPlug.searchText).toContain('\u8a98\u5c0e\u63a8\u92b7');
    expect(mergedPerk.searchText).toContain('bait and switch');
  });
});
