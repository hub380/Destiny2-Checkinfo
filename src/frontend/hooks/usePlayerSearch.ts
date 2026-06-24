import { KeyboardEvent, useEffect, useState } from 'react';
import { searchPlayers } from '../lib/api';
import type { PlayerSearchItemDto } from '../lib/types';

const SEARCH_DEBOUNCE_MS = 280;
const MIN_PREFIX_LENGTH = 2;

export type PlayerSearchState = ReturnType<typeof usePlayerSearch>;

export function usePlayerSearch(query: string) {
  const [suggestions, setSuggestions] = useState<PlayerSearchItemDto[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const value = query.trim();
    if (!value || value.includes('#') || value.length < MIN_PREFIX_LENGTH) {
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
      searchPlayers(value)
        .then((payload) => {
          if (cancelled) return;
          const items = payload.items || [];
          setSuggestions(items);
          setActiveIndex(0);
          setNotice(items.length ? '' : '没有匹配的棒鸡玩家');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
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
    };
  }, [query]);

  async function refreshSuggestions(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < MIN_PREFIX_LENGTH) return [];
    setLoading(true);
    try {
      const payload = await searchPlayers(trimmed);
      const items = payload.items || [];
      setSuggestions(items);
      setActiveIndex(0);
      setNotice(items.length ? '' : '没有匹配的棒鸡玩家');
      return items;
    } catch (err: unknown) {
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
