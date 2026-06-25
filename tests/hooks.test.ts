// @vitest-environment jsdom
/**
 * hooks.test.ts
 *
 * Integration regression tests for useGearSearch and useGuidesLibrary.
 * Specifically guards against URL popstate regressions: mount restore,
 * back/forward navigation, and deduplication of identical-URL popstate.
 *
 * Requires (install once):
 *   npm install -D @testing-library/react jsdom
 */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── api mock ──────────────────────────────────────────────────────────────────
vi.mock('@frontend/lib/api', () => ({
  searchGear: vi.fn().mockResolvedValue({
    query: '末日先知',
    total: 1,
    items: [{ hash: '111', name: '末日先知', kind: 'weapon' }]
  }),
  getGearItem: vi.fn().mockResolvedValue({
    item: { hash: '111', name: '末日先知', kind: 'weapon' },
    detail: {}
  }),
  getPerkWeapons: vi.fn().mockResolvedValue({ perks: [], weapons: [] }),
  getGuides: vi.fn().mockResolvedValue({
    items: [{ slug: 'guide-warlords', title: '战争领主的废墟', type: 'dungeon' }]
  }),
  getGuide: vi.fn().mockResolvedValue({
    slug: 'guide-warlords',
    title: '战争领主的废墟',
    sections: []
  })
}));

import { useGearSearch } from '@frontend/hooks/useGearSearch';
import { useGuidesLibrary } from '@frontend/hooks/useGuidesLibrary';
import * as api from '@frontend/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Set window.location.search via history API (supported by jsdom). */
function setSearch(qs: string) {
  window.history.replaceState(null, '', qs ? `/${qs}` : '/');
}

/** Dispatch a popstate event exactly as the browser would after history navigation. */
function firePopstate() {
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setSearch('');
  vi.clearAllMocks();
  vi.mocked(api.searchGear).mockResolvedValue({
    query: '末日先知',
    total: 1,
    items: [{ hash: '111', name: '末日先知', kind: 'weapon' }]
  });
  vi.mocked(api.getGearItem).mockResolvedValue({
    item: { hash: '111', name: '末日先知', kind: 'weapon' },
    detail: {}
  });
  vi.mocked(api.getPerkWeapons).mockResolvedValue({ perks: [], weapons: [] });
  vi.mocked(api.getGuides).mockResolvedValue({
    items: [{ slug: 'guide-warlords', title: '战争领主的废墟', type: 'dungeon' }]
  });
  vi.mocked(api.getGuide).mockResolvedValue({
    slug: 'guide-warlords',
    title: '战争领主的废墟',
    sections: []
  });
});

afterEach(() => {
  cleanup();
  setSearch('');
});

// ── useGearSearch ─────────────────────────────────────────────────────────────

describe('useGearSearch popstate regression', () => {
  it('mounts idle when URL has no params', () => {
    const { result } = renderHook(() => useGearSearch());
    expect(result.current.query).toBe('');
    expect(result.current.payload).toBeNull();
    expect(api.searchGear).not.toHaveBeenCalled();
  });

  it('auto-runs search when URL has ?q= on mount', async () => {
    setSearch('?q=末日先知');
    const { result } = renderHook(() => useGearSearch());
    await waitFor(() => expect(result.current.payload).not.toBeNull());
    expect(result.current.query).toBe('末日先知');
    expect(api.searchGear).toHaveBeenCalledWith('末日先知');
    expect(api.searchGear).toHaveBeenCalledTimes(1);
  });

  it('auto-opens detail when URL has both ?q= and ?hash= on mount', async () => {
    setSearch('?q=末日先知&hash=111');
    vi.mocked(api.searchGear).mockResolvedValue({
      query: '末日先知',
      total: 1,
      items: [{ hash: '111', name: '末日先知', kind: 'weapon' }]
    });
    const { result } = renderHook(() => useGearSearch());
    await waitFor(() => expect(result.current.detail).not.toBeNull());
    await waitFor(() => expect(result.current.detail?.loading).toBeFalsy());
    expect(result.current.activeHash).toBe('111');
    expect(api.getGearItem).toHaveBeenCalledWith('111');
  });

  it('re-runs search on popstate when q param changes', async () => {
    const { result } = renderHook(() => useGearSearch());

    // Programmatic search (simulates user typing)
    await act(async () => {
      await result.current.runSearch('末日先知');
    });
    expect(api.searchGear).toHaveBeenCalledTimes(1);

    // Simulate back navigation to a different search
    vi.mocked(api.searchGear).mockResolvedValue({
      query: '全知之眼', total: 1,
      items: [{ hash: '222', name: '全知之眼', kind: 'weapon' }]
    });
    setSearch('?q=全知之眼');
    await act(async () => { firePopstate(); });
    await waitFor(() => expect(result.current.query).toBe('全知之眼'));
    expect(api.searchGear).toHaveBeenCalledTimes(2);
    expect(api.searchGear).toHaveBeenLastCalledWith('全知之眼');
  });

  it('clears state on popstate to empty URL (back to home)', async () => {
    setSearch('?q=末日先知');
    const { result } = renderHook(() => useGearSearch());
    await waitFor(() => expect(result.current.payload).not.toBeNull());

    setSearch('');
    await act(async () => { firePopstate(); });
    await waitFor(() => expect(result.current.payload).toBeNull());
    expect(result.current.query).toBe('');
  });

  it('does NOT duplicate the API call when popstate fires with same q as current result', async () => {
    setSearch('?q=末日先知');
    const { result } = renderHook(() => useGearSearch());
    await waitFor(() => expect(result.current.payload).not.toBeNull());

    const callCount = vi.mocked(api.searchGear).mock.calls.length;

    // Popstate with identical URL — should be a no-op
    await act(async () => { firePopstate(); });
    // Allow one tick for any async effects to settle
    await new Promise((r) => setTimeout(r, 20));

    expect(vi.mocked(api.searchGear).mock.calls.length).toBe(callCount);
  });
});

// ── useGuidesLibrary ──────────────────────────────────────────────────────────

describe('useGuidesLibrary popstate regression', () => {
  it('loads guide index on mount', async () => {
    const { result } = renderHook(() => useGuidesLibrary());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(api.getGuides).toHaveBeenCalledTimes(1);
  });

  it('auto-opens guide detail when URL has ?slug= on mount', async () => {
    setSearch('?slug=guide-warlords');
    const { result } = renderHook(() => useGuidesLibrary());
    await waitFor(() => expect(result.current.detail).not.toBeNull(), { timeout: 2000 });
    expect(result.current.detail?.slug).toBe('guide-warlords');
    expect(api.getGuide).toHaveBeenCalledWith('guide-warlords');
  });

  it('opens guide on popstate with slug param', async () => {
    const { result } = renderHook(() => useGuidesLibrary());
    await waitFor(() => expect(result.current.loading).toBe(false));

    setSearch('?slug=guide-warlords');
    await act(async () => { firePopstate(); });
    await waitFor(() => expect(result.current.detail).not.toBeNull(), { timeout: 2000 });
    expect(api.getGuide).toHaveBeenCalledWith('guide-warlords');
  });

  it('closes guide on popstate to URL without slug', async () => {
    setSearch('?slug=guide-warlords');
    const { result } = renderHook(() => useGuidesLibrary());
    await waitFor(() => expect(result.current.detail).not.toBeNull(), { timeout: 2000 });

    setSearch('');
    await act(async () => { firePopstate(); });
    await waitFor(() => expect(result.current.detail).toBeNull());
  });

  it('does NOT re-fetch guide when popstate slug matches already-open detail', async () => {
    setSearch('?slug=guide-warlords');
    const { result } = renderHook(() => useGuidesLibrary());
    await waitFor(() => expect(result.current.detail).not.toBeNull(), { timeout: 2000 });

    const callCount = vi.mocked(api.getGuide).mock.calls.length;

    // Same slug popstate — should be a no-op (deduplication guard in applyFromUrl)
    await act(async () => { firePopstate(); });
    await new Promise((r) => setTimeout(r, 20));

    expect(vi.mocked(api.getGuide).mock.calls.length).toBe(callCount);
  });
});
