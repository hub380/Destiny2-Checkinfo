import { describe, expect, it } from 'vitest';
import { handleAppRequest } from '../src/app/index.js';

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
    name: '国王的陨落 头盔',
    kind: 'armor',
    type: '头盔',
    icon: '/armor-set.png',
    tier: '传说',
    className: '泰坦',
    searchText: '国王的陨落 头盔 raid',
    sourceHints: [{ text: '国王的陨落', label: 'Raid' }],
    hasSetBonus: true,
    setBonusName: '战争祭司遗产'
  };
  const armorWithoutSetBonus = {
    hash: 3002,
    name: '国王的陨落 旧头盔',
    kind: 'armor',
    type: '头盔',
    icon: '/armor-old.png',
    tier: '传说',
    className: '泰坦',
    searchText: '国王的陨落 旧头盔 raid',
    sourceHints: [{ text: '国王的陨落', label: 'Raid' }]
  };
  const weapon = {
    hash: 1001,
    name: '恶意触碰',
    baseName: '恶意触碰',
    kind: 'weapon',
    type: '武器',
    weaponType: '斥候步枪',
    ammo: '动能槽',
    element: '动能',
    icon: '/weapon.png',
    searchText: '恶意触碰 国王的陨落 raid',
    sourceHints: [{ text: '国王的陨落', label: 'Raid' }]
  };
  const perk = {
    hash: 2001,
    name: '诱导推销',
    kind: 'perk',
    type: '特性',
    icon: '/perk.png',
    description: '造成伤害后提升表现。',
    searchText: '诱导推销'
  };
  return {
    manifestVersion: 'test-manifest',
    items: [armorWithoutSetBonus, weapon, armorWithSetBonus, perk],
    weapons: [
      {
        ...weapon,
        sockets: [{ socketIndex: 3, label: '第 4 列', perks: [2001] }]
      }
    ],
    armors: [
      {
        ...armorWithSetBonus,
        setBonus: {
          name: '战争祭司遗产',
          perks: [{ hash: 9001, name: '两件套', description: '2 件套效果' }]
        }
      },
      armorWithoutSetBonus
    ]
  };
}

function envWithStaticGearIndex() {
  return {
    BUNGIE_API_KEY: 'test-key',
    BUNGIE_LOCALE: 'test',
    GEAR_INDEX_CACHE_TTL_SECONDS: '60',
    ASSETS: {
      fetch: async (assetRequest) => {
        const url = new URL(assetRequest.url);
        if (url.pathname === '/data/gear-index-test.json') {
          return Response.json(gearFixture());
        }
        return new Response('not found', { status: 404 });
      }
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
        body: JSON.stringify({ query: '国王的陨落', kind: 'armor' })
      }),
      envWithStaticGearIndex()
    );
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.cache.gearIndex).toMatch(/miss|hit/);
    expect(payload.items.map((item) => item.hash)).toEqual([3001, 3002]);
    expect(payload.items[0].hasSetBonus).toBe(true);
    expect(payload.items[0].setBonusName).toBe('战争祭司遗产');
  });

  it('keeps guide list available when R2 content is empty', async () => {
    const response = await handleAppRequest(request('/api/guides'), { R2_GUIDE_PREFIX: 'guides-test' });
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([]);
    expect(payload.cache.guides).toBe('empty-r2');
  });
});
