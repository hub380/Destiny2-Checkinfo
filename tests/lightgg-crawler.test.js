import { describe, expect, it } from 'vitest';
import { buildLightggCrawlQueue } from '../src/lib/gear/lightgg-crawler.js';
import {
  classifyLightggPage,
  waitForLightggPage
} from '../scripts/gear/lightgg-browser.js';

describe('Light.gg crawl queue', () => {
  it('deduplicates weapons and skips completed snapshots and terminal state', () => {
    const queue = buildLightggCrawlQueue(
      [
        { hash: 3003, name: 'Third' },
        { hash: 1001, name: 'First' },
        { hash: 1001, name: 'First duplicate' },
        { hash: 2002, name: 'Second' },
        { hash: 'invalid', name: 'Invalid' }
      ],
      {
        snapshotHashes: new Set([1001]),
        crawlItems: {
          2002: { status: 'empty' }
        }
      }
    );

    expect(queue).toEqual([{ hash: 3003, name: 'Third' }]);
  });

  it('can retry empty and failed records without recrawling saved snapshots', () => {
    const weapons = [
      { hash: 1001, name: 'Saved' },
      { hash: 2002, name: 'Empty' },
      { hash: 3003, name: 'Failed' }
    ];

    const queue = buildLightggCrawlQueue(weapons, {
      snapshotHashes: new Set([1001]),
      crawlItems: {
        2002: { status: 'empty' },
        3003: { status: 'failed' }
      },
      retryEmpty: true,
      retryFailed: true
    });

    expect(queue.map((item) => item.hash)).toEqual([2002, 3003]);
  });

  it('sorts by hash and applies a bounded batch limit', () => {
    const queue = buildLightggCrawlQueue(
      [
        { hash: 4004, name: 'Fourth' },
        { hash: 2002, name: 'Second' },
        { hash: 3003, name: 'Third' },
        { hash: 1001, name: 'First' }
      ],
      { limit: 2 }
    );

    expect(queue).toEqual([
      { hash: 1001, name: 'First' },
      { hash: 2002, name: 'Second' }
    ]);
  });
});

describe('Light.gg page wait state', () => {
  it('recognizes localized Cloudflare verification pages', () => {
    expect(classifyLightggPage({ title: '请稍候…' }).challenge).toBe(true);
    expect(classifyLightggPage({ hasChallengeElement: true }).challenge).toBe(true);
  });

  it('starts a fresh settle window after a Cloudflare challenge clears', async () => {
    const states = [
      { challenge: true, ready: false, notFound: false },
      { challenge: false, ready: false, notFound: false },
      { challenge: false, ready: true, notFound: false }
    ];
    const page = {
      evaluate: async () => states.shift() || { challenge: false, ready: true, notFound: false },
      waitForTimeout: async () => new Promise((resolve) => setTimeout(resolve, 8))
    };

    const result = await waitForLightggPage(page, {
      challengeTimeoutMs: 100,
      pollIntervalMs: 1,
      settleTimeoutMs: 5
    });

    expect(result.ready).toBe(true);
    expect(result.empty).not.toBe(true);
  });
});
