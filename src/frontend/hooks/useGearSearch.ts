import { FormEvent, useCallback, useRef, useState } from 'react';
import { getGearItem, getPerkWeapons, searchGear } from '@frontend/lib/api';
import { formatCacheHint, mergeCacheHints } from '@frontend/lib/cache-hint';
import { pushRecentQuery } from '@frontend/lib/recent-queries';
import type { GearSearchDto, JsonRecord } from '@frontend/lib/types';
import {
  COPY_GEAR_IDLE_SUBTITLE,
  COPY_GEAR_REQUIRED
} from '@frontend/lib/copy';
import { formatNumber } from '@frontend/lib/format';
import { syncUrlParams } from '@frontend/lib';
import { useUrlParamsSync } from './useUrlQueryParam';
import { useAbortableRequest } from './useAbortableRequest';

const URL_PARAMS = ['q', 'hash', 'kind'] as const;
const KIND_VALUES = new Set(['all', 'weapon', 'armor', 'perk']);

type RunSearchOptions = {
  skipUrlWrite?: boolean;
  signal?: AbortSignal;
  keepDetail?: boolean;
  kind?: string;
};

type OpenItemOptions = {
  skipUrlWrite?: boolean;
  signal?: AbortSignal;
};

function normalizeKind(value: string | undefined) {
  const next = (value || 'all').trim();
  return KIND_VALUES.has(next) ? next : 'all';
}

export function useGearSearch() {
  const [query, setQueryState] = useState('');
  const [payload, setPayload] = useState<GearSearchDto | null>(null);
  const [detail, setDetail] = useState<JsonRecord | null>(null);
  const [activeHash, setActiveHash] = useState('');
  const [subtitle, setSubtitle] = useState(COPY_GEAR_IDLE_SUBTITLE);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [kind, setKindState] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const payloadRef = useRef(payload);
  const lastQueryRef = useRef('');
  const { begin, abort } = useAbortableRequest();

  const setKind = useCallback((value: string) => {
    const next = normalizeKind(value);
    setKindState(next);
    setResultFilter(next === 'all' ? 'all' : next);
  }, []);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
  }, []);

  const runSearch = useCallback(async (rawQuery: string, options?: RunSearchOptions) => {
    const value = rawQuery.trim();
    if (!value) {
      setNotice(COPY_GEAR_REQUIRED);
      setError(true);
      return;
    }
    const signal = options?.signal ?? begin();
    const searchKind = normalizeKind(options?.kind ?? kind);
    setSearching(true);
    setNotice('');
    setError(false);
    payloadRef.current = null;
    setPayload(null);
    setActiveHash('');
    if (!options?.keepDetail) {
      setDetail({ loading: true, message: '首次加载索引可能需要几秒' });
    }
    setSubtitle('装备索引查询中');
    if (!options?.skipUrlWrite) {
      syncUrlParams({
        q: value,
        hash: null,
        kind: searchKind === 'all' ? null : searchKind
      });
    }
    try {
      const data = await searchGear(value, searchKind, signal);
      payloadRef.current = data;
      setPayload(data);
      setDetail(null);
      pushRecentQuery('gear', value);
      lastQueryRef.current = value;
      setSubtitle(mergeCacheHints(`统一搜索 · ${formatNumber(data.total || 0)} 条`, formatCacheHint(data.cache)));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : '装备搜索失败';
      setNotice(message);
      setError(true);
      setDetail(null);
      setSubtitle('装备搜索');
    } finally {
      setSearching(false);
    }
  }, [begin, kind]);

  const retry = useCallback(() => {
    const value = lastQueryRef.current || query.trim();
    if (!value) return;
    abort();
    void runSearch(value, { signal: begin(), kind });
  }, [abort, begin, kind, query, runSearch]);

  const openItem = useCallback(async (item: JsonRecord, options?: OpenItemOptions) => {
    const hash = String(item.hash || '');
    const signal = options?.signal ?? begin();
    if (hash) {
      setActiveHash(hash);
      if (!options?.skipUrlWrite) syncUrlParams({ hash });
    }
    setDetail({ loading: true, message: item.kind === 'perk' ? '反查可出武器中' : '加载装备详情中' });
    try {
      const nextDetail =
        item.kind === 'perk'
          ? await getPerkWeapons({ hash: item.hash, query: item.name }, signal)
          : await getGearItem(String(item.hash), signal);
      setDetail(nextDetail);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : '详情加载失败';
      setDetail({ error: message });
    }
  }, [begin]);

  const openPerk = useCallback(
    async (perk: JsonRecord) => {
      await openItem({ ...perk, kind: 'perk' });
    },
    [openItem]
  );

  const openItemByHash = useCallback(
    async (hash: string, signal?: AbortSignal) => {
      const items = Array.isArray(payloadRef.current?.items) ? payloadRef.current.items : [];
      const match = items.find((item) => String(item.hash) === hash);
      if (match) {
        await openItem(match, { skipUrlWrite: true, signal });
        return;
      }
      setActiveHash(hash);
      setDetail({ loading: true, message: '加载装备详情中' });
      try {
        setDetail(await getGearItem(hash, signal));
      } catch {
        try {
          setDetail(await getPerkWeapons({ hash }, signal));
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const message = err instanceof Error ? err.message : '详情加载失败';
          setDetail({ error: message });
        }
      }
    },
    [openItem]
  );

  const applyFromUrl = useCallback(
    async (values: Record<string, string>) => {
      abort();
      const signal = begin();
      const urlQ = values.q || '';
      const urlHash = values.hash || '';
      const urlKind = normalizeKind(values.kind);
      setQueryState(urlQ);
      setActiveHash(urlHash);
      setKindState(urlKind);
      setResultFilter(urlKind === 'all' ? 'all' : urlKind);

      if (urlQ) {
        const needsSearch = !payloadRef.current || payloadRef.current.query !== urlQ;
        if (needsSearch) {
          await runSearch(urlQ, { skipUrlWrite: true, signal, keepDetail: Boolean(urlHash), kind: urlKind });
        }
        if (signal.aborted) return;
        if (urlHash) {
          await openItemByHash(urlHash, signal);
        }
        if (!urlHash) setDetail(null);
      } else {
        payloadRef.current = null;
        setPayload(null);
        setDetail(null);
        setSubtitle(COPY_GEAR_IDLE_SUBTITLE);
      }
    },
    [abort, begin, openItemByHash, runSearch]
  );

  useUrlParamsSync(URL_PARAMS, (values) => {
    void applyFromUrl(values);
  });

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (searching) return;
      abort();
      await runSearch(query, { signal: begin(), kind });
    },
    [abort, begin, kind, query, runSearch, searching]
  );

  const effectiveFilter = kind === 'all' ? resultFilter : kind;

  return {
    query,
    setQuery,
    payload,
    detail,
    activeHash,
    subtitle,
    notice,
    error,
    searching,
    kind,
    setKind,
    resultFilter,
    setResultFilter,
    effectiveFilter,
    retry,
    runSearch,
    openItem,
    openPerk,
    onSubmit
  };
}
