import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { searchPlayers } from '@frontend/lib/api';
import type { PlayerSearchItemDto } from '@frontend/lib/types';

const SEARCH_DEBOUNCE_MS = 450;
const MIN_PREFIX_LENGTH = 2;

export type PlayerSearchState = ReturnType<typeof usePlayerSearch>;

export function usePlayerSearch(query: string) {
  const [suggestions, setSuggestions] = useState<PlayerSearchItemDto[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (!value || value.includes('#') || value.length < MIN_PREFIX_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
      setNotice('');
      setLoading(false);
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    setOpen(true);
    setLoading(true);
    setNotice('');
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      searchPlayers(value, controller.signal)
        .then((payload) => {
          if (cancelled) return;
          const items = payload.items || [];
          setSuggestions(items);
          setActiveIndex(0);
          setNotice(items.length ? '' : '没有匹配的棒鸡玩家');
        })
        .catch((err: unknown) => {
          if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
          setSuggestions([]);
          setNotice(err instanceof Error ? err.message : '玩家搜索失败');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query]);

  async function refreshSuggestions(value: string) {
    abortRef.current?.abort();
    const trimmed = value.trim();
    if (trimmed.length < MIN_PREFIX_LENGTH) return [];
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const payload = await searchPlayers(trimmed, controller.signal);
      const items = payload.items || [];
      setSuggestions(items);
      setActiveIndex(0);
      setNotice(items.length ? '' : '没有匹配的棒鸡玩家');
      return items;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return [];
      setNotice(err instanceof Error ? err.message : '玩家搜索失败');
      return [];
    } finally {
      setLoading(false);
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
  }

  function clearSuggestions() {
    abortRef.current?.abort();
    setSuggestions([]);
    setNotice('');
    setOpen(false);
  }

  return {
    suggestions,
    notice,
    loading,
    open,
    activeIndex,
    setOpen,
    setActiveIndex,
    onSearchKeyDown,
    refreshSuggestions,
    clearSuggestions
  };
}
