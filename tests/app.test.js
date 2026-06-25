import { describe, expect, it } from 'vitest';
import { handleAppRequest } from '../src/app/index.js';
import {
  gearItemPath,
  perkWeaponsPath,
  searchShardPath,
  sourceAliasesPath,
  sourceIndexPath,
  sourceKeyFor
} from '../src/lib/gear/split-paths.js';

const BASE_URL = 'https://destiny2-checkinfo.test';

function request(path, options = {}) {
  return new Request(`${BASE_URL}${path}`, options);
}

async function responseJson(response) {
  return response.json();
}

function gearFixture() {
  const armorWithSetBonus = {
    hash: 3001,
    name: 'Kings Fall Helm',
    kind: 'armor',
    type: 'Helmet',
    icon: '/armor-set.png',
    tier: 'Legendary',
    className: 'Titan',
    searchText: "kings fall helm raid",
    sourceHints: [{ text: "King's Fall", label: '收藏品来源' }],
    hasSetBonus: true,
    setBonusName: 'Warpriest Legacy'
  };
  const armorWithoutSetBonus = {
    hash: 3002,
    name: 'Kings Fall Old Helm',
    kind: 'armor',
    type: 'Helmet',
    icon: '/armor-old.png',
    tier: 'Legendary',
    className: 'Titan',
    searchText: "kings fall old helm raid",
    sourceHints: [{ text: "King's Fall", label: '收藏品来源' }]
  };
  const weapon = {
    hash: 1001,
    name: 'Calamity',
    baseName: 'Calamity',
    kind: 'weapon',
    type: 'Linear Fusion Rifle',
    weaponType: 'Linear Fusion Rifle',
    ammo: 'Heavy',
    element: 'Solar',
    icon: '/weapon.png',
    searchText: "calamity kings fall raid bait and switch",
    sourceHints: [{ text: "King's Fall", label: '收藏品来源' }]
  };
  const perk = {
    hash: 2001,
    name: 'Bait and Switch',
    kind: 'perk',
    type: 'Trait',
    icon: '/perk.png',
    enhanced: false,
    description: 'Damage bonus.',
    category: 'trait',
    stats: [],
    searchText: 'bait and switch'
  };
  return {
    manifestVersion: 'test-manifest',
    locale: 'test',
    items: [armorWithoutSetBonus, weapon, armorWithSetBonus, perk],
    weapons: [
      {
        ...weapon,
        stats: [{ hash: 10, name: 'Impact', value: 92 }],
        sockets: [{ socketIndex: 3, label: 'Trait', perks: [perk] }]
      }
    ],
    armors: [
      {
        ...armorWithSetBonus,
        setBonus: {
          name: 'Warpriest Legacy',
          perks: [{ hash: 9001, name: 'Two piece', description: '2 piece bonus' }]
        }
      },
      armorWithoutSetBonus
    ],
    weaponPlugs: [perk]
  };
}

function envWithStaticGearIndex() {
  const fixture = gearFixture();
  const root = fixture.manifestVersion;
  const sourceText = "King's Fall";
  const sourceKey = sourceKeyFor(sourceText);
  const files = new Map([
    ['latest.json', { schemaVersion: 2, locale: 'test', manifestVersion: root, root }],
    [
      `${root}/${searchShardPath('armor')}`,
      { schemaVersion: 2, kind: 'armor', locale: 'test', manifestVersion: root, items: fixture.items.filter((item) => item.kind === 'armor') }
    ],
    [
      `${root}/${searchShardPath('weapon')}`,
      { schemaVersion: 2, kind: 'weapon', locale: 'test', manifestVersion: root, items: fixture.items.filter((item) => item.kind === 'weapon') }
    ],
    [
      `${root}/${searchShardPath('perk')}`,
      { schemaVersion: 2, kind: 'perk', locale: 'test', manifestVersion: root, items: fixture.items.filter((item) => item.kind === 'perk') }
    ],
    [
      `${root}/${gearItemPath(1001)}`,
      { schemaVersion: 2, locale: 'test', manifestVersion: root, kind: 'weapon', hash: 1001, item: fixture.items.find((item) => item.hash === 1001), itemRecord: fixture.weapons[0] }
    ],
    [
      `${root}/${perkWeaponsPath(2001)}`,
      {
        schemaVersion: 2,
        locale: 'test',
        manifestVersion: root,
        perkHash: 2001,
        weapons: [
          {
            name: 'Calamity',
            weaponType: 'Linear Fusion Rifle',
            ammo: 'Heavy',
            element: 'Solar',
            variants: [
              {
                hash: 1001,
                name: 'Calamity',
                adept: false,
                icon: '/weapon.png',
                stats: [{ hash: 10, name: 'Impact', value: 92 }]
              }
            ]
          }
        ]
      }
    ],
    [
      `${root}/${sourceAliasesPath()}`,
      {
        schemaVersion: 1,
        aliases: {
          [sourceText]: {
            type: 'raid',
            zh: sourceText,
            en: sourceText,
            abbr: ['kf'],
            encounters: [
              {
                key: 'warpriest',
                zh: 'Warpriest',
                en: 'Warpriest',
                abbr: ['warpriest'],
                drops: [{ name: 'Calamity' }]
              }
            ]
          }
        }
      }
    ],
    [
      `${root}/${sourceIndexPath(sourceKey)}`,
      {
        schemaVersion: 2,
        locale: 'test',
        manifestVersion: root,
        sourceKey,
        sourceText,
        items: fixture.items.filter((item) => item.kind !== 'perk'),
        encounters: []
      }
    ]
  ]);
  return {
    BUNGIE_API_KEY: 'test-key',
    BUNGIE_LOCALE: 'test',
    GEAR_INDEX_CACHE_TTL_SECONDS: '60',
    GEAR_DEPS: {
      apiKey: 'test-key',
      locale: 'test',
      cacheTtlSeconds: 60,
      getLatestGearPointer: async () => files.get('latest.json'),
      readGearJson: async (path) => files.get(path) || null
    }
  };
}

describe('handleAppRequest API integration', () => {
  it('returns health JSON with CORS headers', async () => {
    const response = await handleAppRequest(request('/api/health'));
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(payload.ok).toBe(true);
    expect(payload.updatedAt).toEqual(expect.any(String));
  });

  it('handles CORS preflight before route dispatch', async () => {
    const response = await handleAppRequest(request('/api/gear/search', { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('returns JSON 404 when no API route or asset handler exists', async () => {
    const response = await handleAppRequest(request('/missing'));
    const payload = await responseJson(response);

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('passes non-API requests to the asset handler', async () => {
    const response = await handleAppRequest(request('/missing'), {}, {}, {
      assetsFetch: async () => new Response('asset missing', { status: 404 })
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('asset missing');
  });

  it('converts invalid JSON request bodies into API errors', async () => {
    const response = await handleAppRequest(
      request('/api/gear/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad json'
      }),
      envWithStaticGearIndex()
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_JSON');
  });

  it('searches gear through the app router and prioritizes armor with set bonuses', async () => {
    const response = await handleAppRequest(
      request('/api/gear/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: "King's Fall", kind: 'armor' })
      }),
      envWithStaticGearIndex()
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.cache.gearIndex).toBe('source-alias');
    expect(payload.items.map((item) => item.hash)).toEqual([3001, 3002]);
    expect(payload.items[0].hasSetBonus).toBe(true);
    expect(payload.items[0].setBonusName).toBe('Warpriest Legacy');
  });

  it('searches gear by source aliases through source indexes', async () => {
    const response = await handleAppRequest(
      request('/api/gear/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'kf', kind: 'weapon' })
      }),
      envWithStaticGearIndex()
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.cache.gearIndex).toBe('source-alias');
    expect(payload.total).toBe(1);
    expect(payload.items.map((item) => item.hash)).toEqual([1001]);
  });

  it('uses alias encounter drops when source indexes have no encounter metadata', async () => {
    const response = await handleAppRequest(
      request('/api/gear/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'kf warpriest', kind: 'weapon' })
      }),
      envWithStaticGearIndex()
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.cache.gearIndex).toBe('encounter-source');
    expect(payload.encounter.encounterKey).toBe('warpriest');
    expect(payload.items.map((item) => item.hash)).toEqual([1001]);
  });

  it('loads gear item details from a single v2 item file', async () => {
    const response = await handleAppRequest(
      request('/api/gear/item', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hash: '1001' })
      }),
      envWithStaticGearIndex()
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.item.hash).toBe(1001);
    expect(payload.item.sourceHints[0]).toMatchObject({
      label: 'Raid 来源',
      text: "King's Fall",
      sourceAlias: {
        type: 'raid',
        zh: "King's Fall"
      },
      encounters: [
        {
          key: 'warpriest',
          label: 'Warpriest',
          zh: 'Warpriest',
          en: 'Warpriest'
        }
      ]
    });
    expect(payload.detail.sourceHints[0].label).toBe('Raid 来源');
    expect(payload.detail.sourceHints[0].encounters[0].key).toBe('warpriest');
    expect(payload.detail.sockets[0].perks[0].name).toBe('Bait and Switch');
  });

  it('loads perk reverse search from v2 perk weapon files', async () => {
    const response = await handleAppRequest(
      request('/api/gear/perk-weapons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'Bait and Switch' })
      }),
      envWithStaticGearIndex()
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.weapons[0].variants[0].stats).toEqual([{ hash: 10, name: 'Impact', value: 92 }]);
    expect(payload.weapons[0].variants[0].sockets[0].perks[0].matched).toBe(true);
  });

  it('returns a clear 503 when the v2 gear index is missing', async () => {
    const response = await handleAppRequest(
      request('/api/gear/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'Calamity' })
      }),
      { BUNGIE_API_KEY: 'test-key', GEAR_DEPS: { apiKey: 'test-key', getLatestGearPointer: async () => null, readGearJson: async () => null } }
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('GEAR_INDEX_NOT_FOUND');
  });

  it('keeps guide list available when R2 content is empty', async () => {
    const response = await handleAppRequest(request('/api/guides'), { R2_GUIDE_PREFIX: 'guides-test' });
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([]);
    expect(payload.cache.guides).toBe('empty-r2');
  });
});
