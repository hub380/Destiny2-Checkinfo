import { describe, expect, it } from 'vitest';
import { getGearSearchIndex } from '../src/lib/gear/index-cache.js';
import { searchShardPath } from '../src/lib/gear/split-paths.js';

describe('gear index cache', () => {
  it('normalizes short R2 roots when a gear prefix is configured', async () => {
    const manifestVersion = 'test-manifest';
    const files = new Map([
      ['latest.json', { schemaVersion: 2, locale: 'test', manifestVersion, root: manifestVersion }],
      [
        `gear-cache/v2/test/${manifestVersion}/${searchShardPath('weapon')}`,
        {
          schemaVersion: 2,
          kind: 'weapon',
          locale: 'test',
          manifestVersion,
          items: [{ kind: 'weapon', hash: 1001, name: 'Liberation' }]
        }
      ]
    ]);
    const reads = [];

    const result = await getGearSearchIndex({
      locale: 'test',
      gearPrefix: 'gear-cache/v2',
      getLatestGearPointer: async () => files.get('latest.json'),
      readGearJson: async (path) => {
        reads.push(path);
        return files.get(path) || null;
      }
    }, 'weapon');

    expect(result.value.items[0].name).toBe('Liberation');
    expect(reads).toContain(`gear-cache/v2/test/${manifestVersion}/${searchShardPath('weapon')}`);
  });
});
