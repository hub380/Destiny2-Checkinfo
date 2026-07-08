import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bungieNameText,
  getDestinySummary,
  orderedMembershipCandidates
} from '../src/lib/destiny/summary.js';

const xboxMembership = {
  membershipType: 1,
  membershipId: '4611686018528229960',
  crossSaveOverride: 0,
  displayName: 'Player34008544',
  bungieGlobalDisplayName: '洛梓qwq。',
  bungieGlobalDisplayNameCode: 8923
};

const steamMembership = {
  membershipType: 3,
  membershipId: '4611686018523329088',
  crossSaveOverride: 0,
  displayName: '邪恶黄油hamburger',
  bungieGlobalDisplayName: '洛梓qwq。',
  bungieGlobalDisplayNameCode: 8923
};

function bungieResponse(payload) {
  return new Response(JSON.stringify({ ErrorCode: 1, ErrorStatus: 'Success', Message: 'Ok', ...payload }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function bungieError(message = 'We were unable to find your Destiny account information.') {
  return new Response(JSON.stringify({ ErrorCode: 5, ErrorStatus: 'SystemDisabled', Message: message }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function profileResponse(membership) {
  return bungieResponse({
    Response: {
      profile: {
        data: {
          userInfo: membership
        }
      },
      characters: {
        data: {}
      }
    }
  });
}

function statsResponse() {
  return bungieResponse({
    Response: {
      mergedAllCharacters: {
        results: {}
      }
    }
  });
}

function testEnv(label) {
  return {
    BUNGIE_API_KEY: 'test-key',
    BUNGIE_LOCALE: `test-${label}-${Date.now()}-${Math.random()}`
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('destiny summary membership resolution', () => {
  it('tries later memberships when the first same-name profile cannot be read', async () => {
    const fetchMock = vi.fn(async (url) => {
      const text = String(url);
      if (text.includes('/SearchDestinyPlayerByBungieName/')) {
        return bungieResponse({ Response: [xboxMembership, steamMembership] });
      }
      if (text.includes('/Destiny2/1/Profile/')) return bungieError();
      if (text.includes('/Destiny2/1/Account/')) return statsResponse();
      if (text.includes('/Destiny2/3/Profile/')) return profileResponse(steamMembership);
      if (text.includes('/Destiny2/3/Account/')) return statsResponse();
      throw new Error(`Unexpected request: ${text}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await getDestinySummary({ bungieName: '洛梓qwq。#8923' }, testEnv('candidate-fallback'));

    expect(summary.account.membershipType).toBe(3);
    expect(summary.account.membershipId).toBe(steamMembership.membershipId);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/Destiny2/3/Profile/4611686018523329088/'),
      expect.any(Object)
    );
  });

  it('falls back to the legacy full display-name search when BungieName search returns no memberships', async () => {
    const legacyPath = `/SearchDestinyPlayer/-1/${encodeURIComponent('洛梓qwq。#8923')}/`;
    const fetchMock = vi.fn(async (url) => {
      const text = String(url);
      if (text.includes('/SearchDestinyPlayerByBungieName/')) {
        return bungieResponse({ Response: [] });
      }
      if (text.includes(legacyPath)) {
        return bungieResponse({ Response: [steamMembership] });
      }
      if (text.includes('/Destiny2/3/Profile/')) return profileResponse(steamMembership);
      if (text.includes('/Destiny2/3/Account/')) return statsResponse();
      throw new Error(`Unexpected request: ${text}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await getDestinySummary({ bungieName: '洛梓qwq。#8923' }, testEnv('legacy-fallback'));

    expect(summary.queriedName).toBe('洛梓qwq。#8923');
    expect(summary.account.membershipId).toBe(steamMembership.membershipId);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(legacyPath), expect.any(Object));
  });

  it('uses the D1 player-name cache before BungieName search', async () => {
    const fetchMock = vi.fn(async (url) => {
      const text = String(url);
      if (text.includes('/SearchDestinyPlayerByBungieName/') || text.includes('/SearchDestinyPlayer/')) {
        throw new Error(`Unexpected player search: ${text}`);
      }
      if (text.includes('/Destiny2/3/Profile/4611686018523329088/')) return profileResponse(steamMembership);
      if (text.includes('/Destiny2/3/Account/4611686018523329088/')) return statsResponse();
      throw new Error(`Unexpected request: ${text}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const env = {
      ...testEnv('d1-hit'),
      PLAYER_NAMES_DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              membership_type: '3',
              membership_id: steamMembership.membershipId,
              memberships_json: JSON.stringify([steamMembership])
            })
          })
        })
      }
    };

    const summary = await getDestinySummary({ bungieName: '洛梓qwq。#8923' }, env);

    expect(summary.account.membershipId).toBe(steamMembership.membershipId);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/SearchDestinyPlayerByBungieName/'),
      expect.any(Object)
    );
  });

  it('returns a summary when account stats cannot be read', async () => {
    const fetchMock = vi.fn(async (url) => {
      const text = String(url);
      if (text.includes('/SearchDestinyPlayerByBungieName/')) {
        return bungieResponse({ Response: [steamMembership] });
      }
      if (text.includes('/Destiny2/3/Profile/')) return profileResponse(steamMembership);
      if (text.includes('/Destiny2/3/Account/')) return bungieError('Account stats are not available.');
      throw new Error(`Unexpected request: ${text}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await getDestinySummary({ bungieName: '洛梓qwq。#8923' }, testEnv('stats-unavailable'));

    expect(summary.account.membershipType).toBe(3);
    expect(summary.account.membershipId).toBe(steamMembership.membershipId);
    expect(summary.stats.overall.activitiesEntered).toBeNull();
    expect(summary.stats.overall.kills).toBeNull();
  });

  it('falls back to global name search when the legacy Destiny player lookup fails', async () => {
    const fetchMock = vi.fn(async (url) => {
      const text = String(url);
      if (text.includes('/SearchDestinyPlayerByBungieName/')) return bungieError('No exact BungieName match.');
      if (text.includes('/SearchDestinyPlayer/')) return bungieError('Legacy search failed.');
      if (text.includes('/User/Search/GlobalName/0/')) {
        return bungieResponse({
          Response: {
            searchResults: [
              {
                bungieGlobalDisplayName: '雨多光',
                bungieGlobalDisplayNameCode: 4156,
                destinyMemberships: [
                  {
                    ...steamMembership,
                    membershipId: '4611686018485243032',
                    displayName: 'SHY',
                    crossSaveOverride: 3
                  }
                ]
              }
            ],
            hasMore: false
          }
        });
      }
      if (text.includes('/Destiny2/3/Profile/4611686018485243032/')) {
        return profileResponse({
          ...steamMembership,
          membershipId: '4611686018485243032',
          displayName: 'SHY',
          bungieGlobalDisplayName: '雨多光',
          bungieGlobalDisplayNameCode: 4156
        });
      }
      if (text.includes('/Destiny2/3/Account/4611686018485243032/')) return statsResponse();
      throw new Error(`Unexpected request: ${text}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await getDestinySummary({ bungieName: '雨多光#4156' }, testEnv('global-name-fallback'));

    expect(summary.account.membershipType).toBe(3);
    expect(summary.account.membershipId).toBe('4611686018485243032');
    expect(summary.queriedName).toBe('雨多光#4156');
  });

  it('keeps the selected cross-save membership first while retaining fallback candidates', () => {
    const ordered = orderedMembershipCandidates([
      { membershipType: 3, membershipId: 'steam', crossSaveOverride: 0 },
      { membershipType: 6, membershipId: 'epic', crossSaveOverride: 6 }
    ]);

    expect(ordered.map((item) => item.membershipId)).toEqual(['epic', 'steam']);
  });

  it('formats the legacy lookup name with a padded Bungie code', () => {
    expect(bungieNameText({ displayName: '洛梓qwq。', displayNameCode: 8923 })).toBe('洛梓qwq。#8923');
  });
});
