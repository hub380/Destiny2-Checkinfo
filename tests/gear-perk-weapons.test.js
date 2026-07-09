import { describe, expect, it } from 'vitest';
import { getPerkWeapons } from '../src/lib/gear/handlers.js';
import { gearItemPath, perkWeaponsPath, searchShardPath } from '../src/lib/gear/split-paths.js';

describe('gear perk weapon reverse search', () => {
  it('defaults reverse search to 24 weapon groups', async () => {
    const payload = await getPerkWeapons({ query: 'Bait and Switch' }, gearDepsWithFiles(gearFilesWithWeaponGroups(25)));

    expect(payload.weapons).toHaveLength(24);
    expect(payload.total).toBe(25);
    expect(payload.limit).toBe(24);
    expect(payload.offset).toBe(0);
    expect(payload.hasMore).toBe(true);
    expect(payload.cache.perkWeapons).toBe('miss-memory');
  });

  it('uses offset to return later reverse-search pages', async () => {
    const payload = await getPerkWeapons(
      { query: 'Bait and Switch', limit: 10, offset: 20 },
      gearDepsWithFiles(gearFilesWithWeaponGroups(25))
    );

    expect(payload.weapons).toHaveLength(5);
    expect(payload.total).toBe(25);
    expect(payload.limit).toBe(10);
    expect(payload.offset).toBe(20);
    expect(payload.hasMore).toBe(false);
    expect(payload.weapons[0].name).toBe('Weapon 20');
  });

  it('uses a whole-result cache when deps provide getCachedJson', async () => {
    const files = gearFilesWithWeaponGroups(2);
    const cache = new Map();
    const producerCalls = new Map();
    const deps = gearDepsWithFiles(files, {
      getCachedJson: async (key, ttlSeconds, producer) => {
        if (cache.has(key)) {
          const entry = cache.get(key);
          return {
            value: entry.value,
            status: 'hit-memory',
            cachedAt: entry.cachedAt,
            ttlSeconds
          };
        }
        producerCalls.set(key, (producerCalls.get(key) || 0) + 1);
        const value = await producer();
        const entry = {
          value,
          cachedAt: `cached-${producerCalls.size}`
        };
        cache.set(key, entry);
        return {
          value,
          status: 'miss',
          cachedAt: entry.cachedAt,
          ttlSeconds
        };
      }
    });

    const first = await getPerkWeapons({ hash: '2001', limit: 1, offset: 0 }, deps);
    const second = await getPerkWeapons({ hash: '2001', limit: 1, offset: 0 }, deps);
    await getPerkWeapons({ hash: '2001', limit: 1, offset: 1 }, deps);
    const resultCacheKeys = Array.from(producerCalls.keys()).filter((key) => key.startsWith('perk-weapons:'));

    expect(first.cache.perkWeapons).toBe('miss');
    expect(second.cache.perkWeapons).toBe('hit-memory');
    expect(resultCacheKeys).toHaveLength(2);
    expect(producerCalls.get(resultCacheKeys[0])).toBe(1);
    expect(second.weapons[0].variants[0].sockets[0].perks[0].matched).toBe(true);
  });
});

function gearFilesWithWeaponGroups(count) {
  const manifestVersion = 'test-manifest';
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
  const files = new Map([
    ['latest.json', { schemaVersion: 2, locale: 'test', manifestVersion, root: manifestVersion }],
    [
      `${manifestVersion}/${searchShardPath('perk')}`,
      { schemaVersion: 2, kind: 'perk', locale: 'test', manifestVersion, items: [perk] }
    ]
  ]);

  const perkWeapons = {
    schemaVersion: 2,
    locale: 'test',
    manifestVersion,
    perkHash: perk.hash,
    weapons: []
  };

  for (let index = 0; index < count; index += 1) {
    const hash = 1000 + index;
    const weapon = {
      hash,
      name: `Weapon ${String(index).padStart(2, '0')}`,
      baseName: `Weapon ${String(index).padStart(2, '0')}`,
      kind: 'weapon',
      type: 'Hand Cannon',
      weaponType: 'Hand Cannon',
      ammo: 'Primary',
      element: 'Kinetic',
      icon: `/weapon-${index}.png`,
      tier: 'Legendary',
      stats: [{ hash: 10, name: 'Impact', value: 80 + index }],
      sockets: [{ socketIndex: 3, label: 'Trait', perks: [perk] }],
      searchText: `weapon ${index} bait and switch`
    };
    files.set(`${manifestVersion}/${gearItemPath(hash)}`, {
      schemaVersion: 2,
      locale: 'test',
      manifestVersion,
      kind: 'weapon',
      hash,
      item: weapon,
      itemRecord: weapon
    });
    perkWeapons.weapons.push({
      name: weapon.baseName,
      weaponType: weapon.weaponType,
      ammo: weapon.ammo,
      element: weapon.element,
      variants: [
        {
          hash,
          name: weapon.name,
          adept: false,
          icon: weapon.icon,
          stats: weapon.stats
        }
      ]
    });
  }

  files.set(`${manifestVersion}/${perkWeaponsPath(perk.hash)}`, perkWeapons);
  return files;
}

function gearDepsWithFiles(files, overrides = {}) {
  return {
    apiKey: 'test-key',
    locale: 'test',
    cacheTtlSeconds: 60,
    getLatestGearPointer: async () => files.get('latest.json'),
    readGearJson: async (path) => files.get(path) || null,
    ...overrides
  };
}
