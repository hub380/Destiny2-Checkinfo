import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileLightggPerkDetails, parseLightggPerkSnapshot } from '../src/lib/gear/lightgg-perk-details.js';
import { normalizeLightggRollRecommendations } from '../src/lib/gear/lightgg-recommendations.js';
import { writeSplitGearIndex, mergePerks } from '../src/lib/gear/split-writer.js';
import { buildRollRecommendations } from '../src/lib/gear/roll-recommendations.js';
import {
  craftablesPath,
  dungeonAliasesPath,
  gearItemBucketPath,
  gearItemPath,
  joinGearPath,
  perkWeaponsBucketPath,
  perkWeaponsPath,
  raidAliasesPath,
  rollRecommendationsBucketPath,
  sourceAliasesPath,
  uploadManifestPath
} from '../src/lib/gear/split-paths.js';

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
      expect(itemFile.itemRecord.sockets[0].perks[1].championCounters).toEqual([{ type: 'barrier', label: '反屏障' }]);
      expect(itemFile.itemRecord.catalyst?.perk.name).toBe('Catalyst Spark');
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

  it('enriches item detail perks with light.gg effect values without bloating search shards', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'gear-split-'));
    const perkDetailsFile = join(outputDir, 'lightgg-perk-details.json');
    try {
      await writeFile(perkDetailsFile, JSON.stringify({
        schemaVersion: 1,
        source: 'light.gg',
        items: [{
          perkHash: 2001,
          sourceUrl: 'https://www.light.gg/db/items/2001/',
          collectedAt: '2026-07-21T00:00:00.000Z',
          communityResearch: {
            updatedAt: '2026-07-20',
            lines: ['Grants 30% increased damage for 10 seconds.']
          }
        }]
      }));

      await writeSplitGearIndex(gearFixture(), { outputDir, perkDetailsFile });
      const itemFile = JSON.parse(await readFile(join(outputDir, 'test-manifest', gearItemPath(1001)), 'utf8'));
      const perkSearch = JSON.parse(await readFile(join(outputDir, 'test-manifest', 'search', 'perks.json'), 'utf8'));

      expect(itemFile.itemRecord.sockets[0].perks[0].effectDetails).toMatchObject({
        source: 'light.gg',
        updatedAt: '2026-07-20',
        lines: ['获得 30% 增伤，持续 10 秒。']
      });
      expect(perkSearch.items.find((perk) => perk.hash === 2001).effectDetails).toBeUndefined();
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('writes v3 packed buckets, roll recommendations, and upload manifest', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'gear-split-'));
    const rollFile = join(outputDir, 'roll-recommendations-source.json');
    try {
      await writeFile(rollFile, JSON.stringify({
        schemaVersion: 1,
        items: [
          {
            weaponHash: 1001,
            recommendations: [
              {
                id: 'pve-main',
                mode: 'pve',
                label: 'PvE',
                source: 'manual',
                sockets: [{ socketIndex: 3, label: 'Trait', perkHashes: [2001] }]
              }
            ]
          }
        ]
      }));
      await writeSplitGearIndex(gearFixture(), { outputDir, rollRecommendationsFile: rollFile });

      const latest = JSON.parse(await readFile(join(outputDir, 'latest.json'), 'utf8'));
      const itemBucket = JSON.parse(await readFile(join(outputDir, 'test-manifest', gearItemBucketPath(1001)), 'utf8'));
      const perkBucket = JSON.parse(await readFile(join(outputDir, 'test-manifest', perkWeaponsBucketPath(2001)), 'utf8'));
      const rollBucket = JSON.parse(await readFile(join(outputDir, 'test-manifest', rollRecommendationsBucketPath(1001)), 'utf8'));
      const uploadManifest = JSON.parse(await readFile(join(outputDir, uploadManifestPath()), 'utf8'));

      expect(latest.schemaVersion).toBe(3);
      expect(latest.counts.recommendedWeapons).toBe(1);
      expect(latest.counts.recommendationSets).toBe(1);
      expect(itemBucket.items['1001'].itemRecord.sockets[0].perks[0].name).toBe('Bait and Switch');
      expect(perkBucket.perks['2001'].weapons[0].name).toBe('Calamity');
      expect(rollBucket.items['1001'].recommendations[0].sockets[0].perkHashes).toEqual([2001]);
      expect(uploadManifest.files['test-manifest/items/01.json']).toBeTruthy();
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('builds baseline recommendations for every random-roll weapon', () => {
    const recommendations = buildRollRecommendations(gearFixture());

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].weaponHash).toBe(1001);
    expect(recommendations[0].recommendations.map((entry) => entry.id)).toEqual([
      'pve-clear',
      'pve-damage',
      'pvp'
    ]);
    expect(recommendations[0].recommendations[0]).toMatchObject({
      source: 'local-heuristic',
      confidence: 'baseline'
    });
  });

  it('uses curated recommendation files as authoritative weapon overrides', () => {
    const recommendations = buildRollRecommendations(gearFixture(), [{
      weaponHash: 1001,
      recommendations: [{ id: 'curated', mode: 'pve', label: 'Curated', sockets: [] }]
    }]);

    expect(recommendations[0].recommendations).toEqual([
      { id: 'curated', mode: 'pve', label: 'Curated', sockets: [] }
    ]);
  });

  it('appends light.gg community recommendations without replacing local profiles', () => {
    const lightgg = normalizeLightggRollRecommendations({
      source: 'light.gg',
      items: [{
        weaponHash: 1001,
        popularTraitCombos: [{
          popularity: 18.4,
          sockets: [
            { socketIndex: 3, perkHashes: [2001] },
            { socketIndex: 4, perkHashes: [4001] }
          ]
        }],
        popularIndividualPerks: [{
          columnIndex: 3,
          perks: [{ perkHash: 2001, popularity: 24.6 }]
        }]
      }]
    });

    const recommendations = buildRollRecommendations(gearFixture(), lightgg);

    expect(recommendations[0].recommendations.map((entry) => entry.id)).toEqual([
      'pve-clear',
      'pve-damage',
      'pvp',
      'lightgg-1001-2001-4001',
      'lightgg-individual-1001-4-2001'
    ]);
    expect(recommendations[0].recommendations[3]).toMatchObject({
      mode: 'general',
      label: '社区热度 18%',
      source: 'light.gg',
      sockets: [
        { socketIndex: 3, perkHashes: [2001] },
        { socketIndex: 4, perkHashes: [4001] }
      ]
    });
    expect(recommendations[0].recommendations[4]).toMatchObject({
      mode: 'general',
      label: '社区热度 25%',
      source: 'light.gg',
      sockets: [
        { socketIndex: 4, perkHashes: [2001] }
      ]
    });
  });

  it('merges light.gg recommendation files into generated roll buckets', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'gear-split-'));
    const lightggFile = join(outputDir, 'lightgg-rolls.json');
    try {
      await writeFile(lightggFile, JSON.stringify({
        source: 'light.gg',
        items: [{
          weaponHash: 1001,
          popularTraitCombos: [{
            popularity: 12.2,
            sockets: [
              { socketIndex: 3, perkHashes: [2001] },
              { socketIndex: 4, perkHashes: [4001] }
            ]
          }]
        }]
      }));

      await writeSplitGearIndex(gearFixture(), { outputDir, rollRecommendationFiles: [lightggFile] });

      const rollBucket = JSON.parse(await readFile(join(outputDir, 'test-manifest', rollRecommendationsBucketPath(1001)), 'utf8'));
      const recommendations = rollBucket.items['1001'].recommendations;

      expect(recommendations.some((entry) => entry.source === 'local-heuristic')).toBe(true);
      expect(recommendations.some((entry) => entry.source === 'light.gg')).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('writes craftable records as a dedicated v2 shard', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'gear-split-'));
    try {
      await writeSplitGearIndex(gearFixture(), { outputDir });
      const craftables = JSON.parse(await readFile(join(outputDir, 'test-manifest', craftablesPath()), 'utf8'));

      expect(craftables.kind).toBe('craftable');
      expect(craftables.items[0]).toMatchObject({
        kind: 'craftable',
        hash: 3001,
        name: 'Pattern Weapon',
        patternRecordHash: 7001
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('merges source alias maintenance files and writes compatibility outputs', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'gear-split-'));
    const aliasesDir = await mkdtemp(join(tmpdir(), 'gear-aliases-'));
    try {
      const sourceAliasesFile = join(aliasesDir, 'source-aliases.json');
      const raidAliasesFile = join(aliasesDir, 'source-aliases-raids.json');
      const dungeonAliasesFile = join(aliasesDir, 'source-aliases-dungeons.json');
      await writeFile(sourceAliasesFile, JSON.stringify({ schemaVersion: 1, aliases: { Crucible: { type: 'pvp', zh: '熔炉竞技场' } } }));
      await writeFile(raidAliasesFile, JSON.stringify({ schemaVersion: 1, aliases: { "King's Fall": { type: 'raid', zh: '国王的陨落' } } }));
      await writeFile(dungeonAliasesFile, JSON.stringify({ schemaVersion: 1, aliases: { Prophecy: { type: 'dungeon', zh: '预言' } } }));

      await writeSplitGearIndex(gearFixture(), {
        outputDir,
        sourceAliasesFile,
        raidAliasesFile,
        dungeonAliasesFile
      });

      const full = JSON.parse(await readFile(join(outputDir, 'test-manifest', sourceAliasesPath()), 'utf8'));
      const raids = JSON.parse(await readFile(join(outputDir, 'test-manifest', raidAliasesPath()), 'utf8'));
      const dungeons = JSON.parse(await readFile(join(outputDir, 'test-manifest', dungeonAliasesPath()), 'utf8'));

      expect(Object.keys(full.aliases).sort()).toEqual(['Crucible', "King's Fall", 'Prophecy']);
      expect(Object.keys(raids.aliases)).toEqual(["King's Fall"]);
      expect(Object.keys(dungeons.aliases)).toEqual(['Prophecy']);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(aliasesDir, { recursive: true, force: true });
    }
  });
});

describe('light.gg perk detail cache', () => {
  it('keeps concrete community research values and drops generic chrome text', () => {
    const parsed = parseLightggPerkSnapshot({
      perkHash: 3078487919,
      title: 'Bait and Switch - Destiny 2 Basic Trait - light.gg',
      sourceUrl: 'https://www.light.gg/db/items/3078487919/bait-and-switch/',
      collectedAt: '2026-07-21T00:00:00.000Z',
      communityResearchText: [
        'Community Research',
        'Credits',
        'Dealing damage with a weapon starts a 7 second timer.',
        'Grants 30% increased damage for 10 seconds.',
        'Timer is disabled while active.',
        'Last Updated 2024-11-07',
        'Remove All Ads'
      ].join('\n')
    });

    expect(parsed.communityResearch.updatedAt).toBe('2024-11-07');
    expect(parsed.communityResearch.lines).toEqual([
      '造成武器伤害会启动 7 秒计时器。',
      '获得 30% 增伤，持续 10 秒。'
    ]);
  });

  it('compiles latest perk detail snapshot per hash', () => {
    const compiled = compileLightggPerkDetails([
      {
        perkHash: 2001,
        collectedAt: '2026-07-20T00:00:00.000Z',
        communityResearchText: 'Community Research\n5 seconds.\nLast Updated 2026-07-20'
      },
      {
        perkHash: 2001,
        collectedAt: '2026-07-21T00:00:00.000Z',
        communityResearchText: 'Community Research\n10 seconds.\nLast Updated 2026-07-21'
      }
    ]);

    expect(compiled.counts).toEqual({ perks: 1, lines: 1 });
    expect(compiled.items[0].communityResearch.lines).toEqual(['10 秒.']);
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
        sockets: [
          { socketIndex: 3, label: 'Trait 1', perks: [2001, 4001] },
          { socketIndex: 4, label: 'Trait 2', perks: [2001, 4001] }
        ],
        catalyst: {
          perk: { name: 'Catalyst Spark', description: 'Effect.', icon: '/catalyst.png' },
          statBonuses: [{ name: 'Stability', value: 20 }],
          killsRequired: 500,
          progressDescription: 'Defeat targets.'
        }
      }
    ],
    armors: [],
    craftables: [
      {
        kind: 'craftable',
        hash: 3001,
        name: 'Pattern Weapon',
        icon: '/pattern.png',
        type: 'Auto Rifle',
        weaponType: 'Auto Rifle',
        tier: 'Legendary',
        source: "King's Fall",
        sourceHash: 123,
        patternRecordHash: 7001,
        patternObjectiveHash: 7002
      }
    ],
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
        championCounters: [{ type: 'barrier', label: '反屏障' }],
        searchText: 'plug override'
      }
    ]
  };
}
