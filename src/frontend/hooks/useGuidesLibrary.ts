import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGuide, getGuides } from '@frontend/lib/api';
import type { GuideDetailDto, GuideIndexDto, GuideSummaryDto } from '@frontend/lib/types';
import { syncUrlParams } from '@frontend/lib/url';
import { readUrlParams, useUrlParamsSync } from './useUrlQueryParam';

const GUIDE_URL_PARAMS = ['q', 'category', 'slug'] as const;

export function useGuidesLibrary() {
  const [index, setIndex] = useState<GuideIndexDto | null>(null);
  const [detail, setDetail] = useState<GuideDetailDto | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);

  const indexRef = useRef<GuideIndexDto | null>(null);
  const detailRef = useRef<GuideDetailDto | null>(null);
  const detailLoadingRef = useRef(false);
  const skipFilterUrlSyncRef = useRef(true);
  indexRef.current = index;
  detailRef.current = detail;
  detailLoadingRef.current = detailLoading;

  const syncFiltersToUrl = useCallback((nextQuery: string, nextCategory: string) => {
    syncUrlParams({
      q: nextQuery.trim() || null,
      category: nextCategory === 'all' ? null : nextCategory
    });
  }, []);

  const openGuide = useCallback(async (item: GuideSummaryDto, options?: { replace?: boolean }) => {
    setDetailLoading(true);
    setDetail(null);
    setNotice('');
    setError(false);
    try {
      const payload = await getGuide(item.slug);
      setDetail(payload);
      const mode = options?.replace ? 'replace' : 'push';
      syncUrlParams({ slug: item.slug }, mode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '攻略加载失败';
      setNotice(message);
      setError(true);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeGuide = useCallback(() => {
    setDetail(null);
    syncUrlParams({ slug: null });
  }, []);

  const applyFromUrl = useCallback(async (values: Record<string, string>) => {
    const slug = values.slug || '';
    const urlQuery = values.q || '';
    const urlCategory = values.category || 'all';
    skipFilterUrlSyncRef.current = true;
    setQuery(urlQuery);
    setCategory(urlCategory);

    if (!slug) {
      setDetail(null);
      return;
    }
    if (detailRef.current?.slug === slug && !detailLoadingRef.current) return;

    const match = indexRef.current?.items?.find((item) => item.slug === slug);
    if (match) {
      await openGuide(match, { replace: true });
      return;
    }
    if (indexRef.current) {
      await openGuide({ slug, title: slug } as GuideSummaryDto, { replace: true });
    }
  }, [openGuide]);

  const applyFromUrlRef = useRef(applyFromUrl);
  applyFromUrlRef.current = applyFromUrl;

  const loadIndex = useCallback(async () => {
    setLoading(true);
    setNotice('');
    setError(false);
    try {
      const payload = await getGuides();
      indexRef.current = payload;
      setIndex(payload);
      await applyFromUrlRef.current(readUrlParams(GUIDE_URL_PARAMS));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '攻略索引加载失败';
      setNotice(message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useUrlParamsSync(GUIDE_URL_PARAMS, (values) => {
    void applyFromUrlRef.current(values);
  }, { skipMount: true });

  useEffect(() => {
    if (loading) return;
    if (skipFilterUrlSyncRef.current) {
      skipFilterUrlSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => syncFiltersToUrl(query, category), 200);
    return () => window.clearTimeout(timer);
  }, [category, loading, query, syncFiltersToUrl]);

  const setQueryAndUrl = useCallback(
    (value: string) => {
      skipFilterUrlSyncRef.current = false;
      setQuery(value);
      syncFiltersToUrl(value, category);
    },
    [category, syncFiltersToUrl]
  );

  const setCategoryAndUrl = useCallback(
    (value: string) => {
      skipFilterUrlSyncRef.current = false;
      setCategory(value);
      syncFiltersToUrl(query, value);
    },
    [query, syncFiltersToUrl]
  );

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
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [category, items, query]);

  return {
    index,
    detail,
    query,
    setQuery: setQueryAndUrl,
    category,
    setCategory: setCategoryAndUrl,
    loading,
    detailLoading,
    notice,
    error,
    items,
    categories,
    visibleItems,
    openGuide,
    closeGuide,
    reload: loadIndex
  };
}
