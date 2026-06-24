import { FormEvent, useCallback, useRef, useState } from 'react';
import { getGearItem, getPerkWeapons, searchGear } from '@frontend/lib/api';
import type { GearSearchDto, JsonRecord } from '@frontend/lib/types';
import { formatNumber } from '@frontend/lib/format';
import { syncUrlParams } from '@frontend/lib/url';
import { useUrlParamsSync } from './useUrlQueryParam';

const URL_PARAMS = ['q', 'hash'] as const;

type RunSearchOptions = {
  skipUrlWrite?: boolean;
};

type OpenItemOptions = {
  skipUrlWrite?: boolean;
};

export function useGearSearch() {
  const [query, setQueryState] = useState('');
  const [payload, setPayload] = useState<GearSearchDto | null>(null);
  const [detail, setDetail] = useState<JsonRecord | null>(null);
  const [activeHash, setActiveHash] = useState('');
  const [subtitle, setSubtitle] = useState('输入名称查询，点击结果查看详情');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
  }, []);

  const runSearch = useCallback(async (rawQuery: string, options?: RunSearchOptions) => {
    const value = rawQuery.trim();
    if (!value) {
      setNotice('请输入武器、护甲或 Perk 名称。');
      setError(true);
      return;
    }
    setNotice('');
    setError(false);
    setPayload(null);
    setDetail(null);
    setActiveHash('');
    setDetail({ loading: true, message: '首次加载索引可能需要几秒' });
    setSubtitle('装备索引查询中');
    if (!options?.skipUrlWrite) syncUrlParams({ q: value, hash: null });
    try {
      const data = await searchGear(value);
      setPayload(data);
      setDetail(null);
      setSubtitle(`统一搜索 · ${formatNumber(data.total || 0)} 条`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '装备搜索失败';
      setNotice(message);
      setError(true);
      setDetail(null);
      setSubtitle('装备搜索');
    }
  }, []);

  const openItem = useCallback(async (item: JsonRecord, options?: OpenItemOptions) => {
    const hash = String(item.hash || '');
    if (hash) {
      setActiveHash(hash);
      if (!options?.skipUrlWrite) syncUrlParams({ hash });
    }
    setDetail({ loading: true, message: item.kind === 'perk' ? '反查可出武器中' : '加载装备详情中' });
    try {
      if (item.kind === 'perk') {
        setDetail(await getPerkWeapons({ hash: item.hash, query: item.name }));
      } else {
        setDetail(await getGearItem(String(item.hash)));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '详情加载失败';
      setDetail({ error: message });
    }
  }, []);

  const openPerk = useCallback(
    async (perk: JsonRecord) => {
      await openItem({ ...perk, kind: 'perk' });
    },
    [openItem]
  );

  const openItemByHash = useCallback(
    async (hash: string) => {
      const items = Array.isArray(payloadRef.current?.items) ? payloadRef.current.items : [];
      const match = items.find((item) => String(item.hash) === hash);
      if (match) {
        await openItem(match, { skipUrlWrite: true });
        return;
      }
      setActiveHash(hash);
      setDetail({ loading: true, message: '加载装备详情中' });
      try {
        setDetail(await getGearItem(hash));
      } catch {
        try {
          setDetail(await getPerkWeapons({ hash }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '详情加载失败';
          setDetail({ error: message });
        }
      }
    },
    [openItem]
  );

  const applyFromUrl = useCallback(
    async (values: Record<string, string>) => {
      const urlQ = values.q || '';
      const urlHash = values.hash || '';
      setQueryState(urlQ);
      setActiveHash(urlHash);

      if (urlQ) {
        if (!payloadRef.current || payloadRef.current.query !== urlQ) {
          await runSearch(urlQ, { skipUrlWrite: true });
        }
        if (urlHash) await openItemByHash(urlHash);
        else setDetail(null);
      } else {
        setPayload(null);
        setDetail(null);
        setSubtitle('输入名称查询，点击结果查看详情');
      }
    },
    [openItemByHash, runSearch]
  );

  useUrlParamsSync(URL_PARAMS, (values) => {
    void applyFromUrl(values);
  });

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      await runSearch(query);
    },
    [query, runSearch]
  );

  return {
    query,
    setQuery,
    payload,
    detail,
    activeHash,
    subtitle,
    notice,
    error,
    runSearch,
    openItem,
    openPerk,
    onSubmit
  };
}
