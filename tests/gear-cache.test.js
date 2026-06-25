import { describe, expect, it } from 'vitest';
import { getGearCacheStatus } from '../src/lib/gear/cache.js';

describe('gear cache pointer compatibility', () => {
  it('accepts v2 latest pointers with root', async () => {
    const status = await getGearCacheStatus(envWithPointer({
      schemaVersion: 2,
      locale: 'test',
      manifestVersion: 'test-manifest',
      root: 'gear-cache/v2/test/test-manifest'
    }));

    expect(status.latest.manifestVersion).toBe('test-manifest');
    expect(status.latest.root).toBe('gear-cache/v2/test/test-manifest');
  });

  it('keeps accepting legacy v1 pointers with r2Key', async () => {
    const status = await getGearCacheStatus(envWithPointer({
      schemaVersion: 1,
      locale: 'test',
      manifestVersion: 'test-manifest',
      r2Key: 'gear-cache/test/test-manifest/gear-index.json'
    }));

    expect(status.latest.manifestVersion).toBe('test-manifest');
    expect(status.latest.r2Key).toBe('gear-cache/test/test-manifest/gear-index.json');
  });

  it('prefers a v2 R2 pointer over a stale v1 KV pointer', async () => {
    const status = await getGearCacheStatus({
      BUNGIE_LOCALE: 'test',
      R2_GEAR_PREFIX: 'gear-cache/v2',
      CAREER_CACHE: {
        get: async () => ({
          schemaVersion: 1,
          locale: 'test',
          manifestVersion: 'old-manifest',
          r2Key: 'gear-cache/test/old/gear-index.json'
        })
      },
      CAREER_R2: {
        get: async (key) => {
          if (key === 'gear-cache/v2/test/latest.json') {
            return {
              json: async () => ({
                schemaVersion: 2,
                locale: 'test',
                manifestVersion: 'new-manifest',
                root: 'gear-cache/v2/test/new-manifest'
              })
            };
          }
          return null;
        }
      }
    });

    expect(status.latest.manifestVersion).toBe('new-manifest');
    expect(status.latest.source).toBe('r2');
  });
});

function envWithPointer(pointer) {
  return {
    BUNGIE_LOCALE: 'test',
    R2_GEAR_PREFIX: 'gear-cache/v2',
    CAREER_R2: {
      get: async (key) => {
        if (key === 'gear-cache/v2/test/latest.json') {
          return {
            json: async () => pointer
          };
        }
        return null;
      }
    }
  };
}
