import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectEndgameHistory, isPrivateActivityHistoryError } from '../src/lib/destiny/endgame-history.js';

function bungieError(message) {
  return new Response(JSON.stringify({ ErrorCode: 5, ErrorStatus: 'SystemDisabled', Message: message }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function bungieSuccess(response) {
  return new Response(JSON.stringify({ ErrorCode: 1, ErrorStatus: 'Success', Response: response }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('endgame activity history privacy handling', () => {
  it('treats private Bungie activity history as a warning instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => bungieError('The user has chosen for this data to be private.  No peeking!')));
    const output = new Map();
    const warnings = [];

    await collectEndgameHistory(
      { membershipType: 3, membershipId: '4611686018517214647' },
      '2305843000000000001',
      'raid',
      4,
      250,
      50,
      output,
      warnings,
      { BUNGIE_API_KEY: 'test-key' }
    );

    expect(output.size).toBe(0);
    expect(warnings).toEqual(['raid:2305843000000000001 activity history is private']);
  });

  it('still throws non-privacy Bungie errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => bungieError('Bungie is temporarily unavailable')));

    await expect(collectEndgameHistory(
      { membershipType: 3, membershipId: '4611686018517214647' },
      '2305843000000000001',
      'raid',
      4,
      250,
      50,
      new Map(),
      [],
      { BUNGIE_API_KEY: 'test-key' }
    )).rejects.toMatchObject({ code: 'BUNGIE_API_ERROR' });
  });

  it('continues to collect public activity history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => bungieSuccess({
      activities: [
        {
          period: '2026-07-08T00:00:00Z',
          activityDetails: { referenceId: 123, directorActivityHash: 456, mode: 4, modes: [4] },
          values: {
            completed: { basic: { value: 1 } },
            kills: { basic: { value: 10 } },
            deaths: { basic: { value: 2 } },
            playerCount: { basic: { value: 6 } },
            timePlayedSeconds: { basic: { value: 600 } }
          }
        }
      ]
    })));
    const output = new Map();

    await collectEndgameHistory(
      { membershipType: 3, membershipId: '4611686018517214647' },
      '2305843000000000001',
      'raid',
      4,
      250,
      50,
      output,
      [],
      { BUNGIE_API_KEY: 'test-key' }
    );

    expect(output.get('123')).toMatchObject({ clears: 1, kills: 10, deaths: 2 });
  });

  it('identifies Bungie privacy errors narrowly', () => {
    expect(isPrivateActivityHistoryError({
      code: 'BUNGIE_API_ERROR',
      message: 'The user has chosen for this data to be private.  No peeking!'
    })).toBe(true);
    expect(isPrivateActivityHistoryError({
      code: 'BUNGIE_API_ERROR',
      message: 'Bungie is temporarily unavailable'
    })).toBe(false);
  });
});

describe('buildEndgameModeFromStats', () => {
  it('reads formatted summary stat objects', async () => {
    const { buildEndgameModeFromStats } = await import('../src/lib/destiny/endgame-format.js');
    const mode = buildEndgameModeFromStats('pvp', {
      activitiesEntered: { value: 705, displayValue: '705' },
      activitiesWon: { value: 328, displayValue: '328' },
      kills: { value: 5888, displayValue: '5888' },
      deaths: { value: 6635, displayValue: '6635' },
      assists: { value: 2274, displayValue: '2274' },
      secondsPlayed: { value: 360000, displayValue: '360000' }
    });

    expect(mode.total.activitiesEntered.value).toBe(705);
    expect(mode.total.activitiesWon.value).toBe(328);
    expect(mode.total.kills.value).toBe(5888);
    expect(mode.summaryOnly).toBe(true);
    expect(mode.activities).toEqual([]);
  });
});
