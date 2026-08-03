import { describe, expect, it } from 'vitest';
import {
  compileLightggSnapshots,
  parseLightggSnapshot
} from '../src/lib/gear/lightgg-cache.js';

describe('Light.gg recommendation cache', () => {
  it('normalizes trait combos and individual perk popularity from a browser snapshot', () => {
    const item = parseLightggSnapshot({
      weaponHash: 954563454,
      sourceUrl: 'https://www.light.gg/db/items/954563454/',
      title: 'Bitter End - Destiny 2 Legendary Machine Gun - Possible Rolls - light.gg',
      collectedAt: '2026-07-16T12:00:00.000Z',
      sampleSizeText: 'Based on 400.9K+ copies of this weapon.',
      comboRows: [
        {
          perkHashes: ['511499160', '717070634'],
          perkNames: ['Trickle Charge*', 'Jolting Feedback*'],
          text: 'Trickle Charge* + Jolting Feedback* 13.06% of Rolls'
        }
      ],
      individualColumns: [
        [{ perkHash: '839105230', percentage: '18.6%' }],
        [],
        [{ perkHash: '511499160', percentage: '29.6%' }]
      ]
    });

    expect(item).toMatchObject({
      weaponHash: 954563454,
      weaponName: 'Bitter End',
      sampleSize: '400.9K+',
      popularTraitCombos: [{
        popularity: 13.06,
        sockets: [
          { socketIndex: 3, perkHashes: [511499160], perkNames: ['Trickle Charge'] },
          { socketIndex: 4, perkHashes: [717070634], perkNames: ['Jolting Feedback'] }
        ]
      }],
      popularIndividualPerks: [
        { columnIndex: 0, perks: [{ perkHash: 839105230, popularity: 18.6 }] },
        { columnIndex: 2, perks: [{ perkHash: 511499160, popularity: 29.6 }] }
      ]
    });
  });

  it('deduplicates by weapon hash and keeps the newest snapshot', () => {
    const older = snapshot(1001, '2026-07-15T00:00:00.000Z', 5);
    const newer = snapshot(1001, '2026-07-16T00:00:00.000Z', 12.5);
    const other = snapshot(2002, '2026-07-16T00:00:00.000Z', 8);

    const cache = compileLightggSnapshots([newer, other, older], {
      generatedAt: '2026-07-16T01:00:00.000Z'
    });

    expect(cache.items.map((item) => item.weaponHash)).toEqual([1001, 2002]);
    expect(cache.items[0].popularTraitCombos[0].popularity).toBe(12.5);
    expect(cache).toMatchObject({
      schemaVersion: 2,
      source: 'light.gg',
      generatedAt: '2026-07-16T01:00:00.000Z',
      counts: { weapons: 2, traitCombos: 2 }
    });
  });

  it('rejects snapshots without a valid weapon hash or recommendation data', () => {
    expect(parseLightggSnapshot({ weaponHash: 'invalid', comboRows: [] })).toBeNull();
    expect(parseLightggSnapshot({ weaponHash: 1001, comboRows: [], individualColumns: [] })).toBeNull();
  });
});

function snapshot(weaponHash, collectedAt, popularity) {
  return {
    weaponHash,
    collectedAt,
    comboRows: [{
      perkHashes: [3001, 4001],
      perkNames: ['Left', 'Right'],
      text: `Left + Right ${popularity}% of Rolls`
    }]
  };
}
