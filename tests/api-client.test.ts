import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPerkWeapons } from '@frontend/lib/api';

describe('frontend gear API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the lower perk weapon reverse-search limit by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await getPerkWeapons({ hash: '984655331', query: '羸弱能量球' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gear/perk-weapons',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hash: '984655331', query: '羸弱能量球', limit: 24, offset: 0 })
      })
    );
  });

  it('keeps explicit perk weapon reverse-search limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await getPerkWeapons({ hash: '984655331', limit: 12 });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ hash: '984655331', limit: 12, offset: 0 });
  });
});
