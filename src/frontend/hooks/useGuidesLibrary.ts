import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGuide, getGuides } from '../lib/api';
import type { GuideDetailDto, GuideIndexDto, GuideSummaryDto } from '../lib/types';
import { readUrlSearchParam } from './useMountUrlParam';

export function useGuidesLibrary() {
  const [index, setIndex] = useState<GuideIndexDto | null>(null);
  const [detail, setDetail] = useState<GuideDetailDto | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);

  const openGuide = useCallback(async (item: GuideSummaryDto, silent = false) => {
    setDetailLoading(true);
    setDetail(null);
    setNotice('');
    setError(false);
    try {
      const payload = await getGuide(item.slug);
      setDetail(payload);
      if (!silent) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('slug', item.slug);
        window.history.replaceState(null, '', nextUrl);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '攻略加载失败';
      setNotice(message);
      setError(true);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadIndex = useCallback(async () => {
    setLoading(true);
    setNotice('');
    setError(false);
    try {
      const payload = await getGuides();
      setIndex(payload);
      const slug = readUrlSearchParam('slug');
      const match = slug ? payload.items?.find((item) => item.slug === slug) : null;
      if (match) {
        await openGuide(match, true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '攻略索引加载失败';
      setNotice(message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [openGuide]);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  const items = useMemo(() => (Array.isArray(index?.items) ? index.items : []), [index]);

  const categories = useMemo(() => {
    const pairs = new Map<string, string>();
    for (const item of items) {
      if (item.type) pairs.set(item.type, item.typeLabel || item.type);
    }
    return Array.from(pairs, ([value, label]) => ({ value, label }));
  }, [items]);

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && item.type !== category) return false;
      if (!keyword) return true;
      return [
        item.title,
        item.subtitle,
        item.summary,
        item.activityName,
        item.typeLabel,
        ...(item.tags || [])
      ].join(' ').toLowerCase().includes(keyword);
    });
  }, [category, items, query]);

  return {
    index,
    detail,
    query,
    setQuery,
    category,
    setCategory,
    loading,
    detailLoading,
    notice,
    error,
    items,
    categories,
    visibleItems,
    openGuide,
    reload: loadIndex
  };
}
