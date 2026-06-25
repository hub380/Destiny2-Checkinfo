import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSplitGearIndex, mergePerks } from '../src/lib/gear/split-writer.js';
import { gearItemPath, joinGearPath, perkWeaponsPath } from '../src/lib/gear/split-paths.js';

describe('gear split writer', () => {
  it('preserves nested paths when joining gear cache keys', () => {
    expect(joinGearPath('/test-manifest/', 'search/weapons.json')).toBe('test-manifest/search/weapons.json');
  });

  it('keeps weaponPlug data preferred when perk hashes overlap', () => {
    const perks = mergePerks(gearFixture());

    expect(perks.find((perk) => perk.hash === 4001).name).toBe('Plug Override');
  });

  it('writes item records with sockets and no perkColumns', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'gear-split-'));
    try {
      await writeSplitGearIndex(gearFixture(), { outputDir });
      const itemFile = JSON.parse(await readFile(join(outputDir, 'test-manifest', gearItemPath(1001)), 'utf8'));

      expect(itemFile.itemRecord.sockets[0].perks[0].name).toBe('Bait and Switch');
      expect(itemFile.itemRecord.sockets[0].perks[1].name).toBe('Plug Override');
      expect(itemFile.itemRecord.perkColumns).toBeUndefined();
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('writes compact perk weapon files without stats, sockets, or screenshots', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'gear-split-'));
    try {
      await writeSplitGearIndex(gearFixture(), { outputDir });
      const perkWeaponsIndex = JSON.parse(await readFile(join(outputDir, 'test-manifest', perkWeaponsPath(2001)), 'utf8'));
      const variant = perkWeaponsIndex.weapons[0].variants[0];

      expect(variant.stats).toBeUndefined();
      expect(variant.screenshot).toBeUndefined();
      expect(variant.sockets).toBeUndefined();
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

function gearFixture() {
  const weaponItem = {
    kind: 'weapon',
    hash: 1001,
    name: 'Calamity',
    icon: '/weapon.png',
    type: 'Linear Fusion Rifle',
    weaponType: 'Linear Fusion Rifle',
    ammo: 'Heavy',
    element: 'Solar',
    tier: 'Legendary',
    adept: false,
    description: 'Test weapon',
    sourceHints: [{ text: "King's Fall", label: 'Raid' }],
    searchText: "calamity king's fall bait"
  };
  const perkItem = {
    kind: 'perk',
    hash: 2001,
    name: 'Bait and Switch',
    icon: '/perk.png',
    type: 'Trait',
    enhanced: false,
    description: 'Damage bonus.',
    category: 'trait',
    stats: [],
    searchText: 'bait and switch'
  };
  return {
    indexVersion: 'test',
    locale: 'test',
    manifestVersion: 'test-manifest',
    builtAt: '2026-06-25T00:00:00.000Z',
    items: [
      weaponItem,
      perkItem,
      {
        kind: 'perk',
        hash: 4001,
        name: 'Item Loses',
        icon: '/item.png',
        type: 'Trait',
        enhanced: false,
        description: 'Item version.',
        category: 'trait',
        stats: [],
        searchText: 'item loses'
      }
    ],
    weapons: [
      {
        ...weaponItem,
        baseName: 'Calamity',
        stats: [{ hash: 10, name: 'Impact', value: 92 }],
        screenshot: '/screenshot.jpg',
        sockets: [{ socketIndex: 3, label: 'Trait', perks: [2001, 4001] }]
      }
    ],
    armors: [],
    craftables: [],
    weaponPlugs: [
      {
        hash: 4001,
        name: 'Plug Override',
        icon: '/plug.png',
        type: 'Trait',
        enhanced: false,
        description: 'Plug version.',
        category: 'trait',
        stats: [],
        searchText: 'plug override'
      }
    ]
  };
}
