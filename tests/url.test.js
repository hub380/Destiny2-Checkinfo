import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readUrlSearchParam, syncUrlParams } from '@frontend/lib/url';
import { readUrlParams } from '@frontend/hooks/useUrlQueryParam';

function mockLocation(pathname, search) {
  const href = `http://localhost${pathname}${search}`;
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: { href, pathname, search, hash: '' },
      history: {
        replaceState: vi.fn(),
        pushState: vi.fn()
      }
    },
    configurable: true
  });
}

describe('readUrlSearchParam', () => {
  beforeEach(() => {
    mockLocation('/career.html', '?q=Guardian%231234&hash=99');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads a single query param', () => {
    expect(readUrlSearchParam('q')).toBe('Guardian#1234');
    expect(readUrlSearchParam('hash')).toBe('99');
    expect(readUrlSearchParam('missing')).toBeUndefined();
  });

  it('reads multiple params via readUrlParams', () => {
    expect(readUrlParams(['q', 'hash'])).toEqual({ q: 'Guardian#1234', hash: '99' });
    expect(readUrlParams(['q', 'missing'])).toEqual({ q: 'Guardian#1234', missing: '' });
  });
});

describe('syncUrlParams', () => {
  beforeEach(() => {
    mockLocation('/gear.html', '?q=sword');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates search params with replaceState', () => {
    syncUrlParams({ q: 'hammer', hash: '42' });
    expect(window.history.replaceState).toHaveBeenCalledOnce();
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/gear.html?q=hammer&hash=42');
  });

  it('removes params when value is empty', () => {
    syncUrlParams({ q: null, hash: '7' });
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/gear.html?hash=7');
  });

  it('skips history write when url unchanged', () => {
    syncUrlParams({ q: 'sword' });
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});
