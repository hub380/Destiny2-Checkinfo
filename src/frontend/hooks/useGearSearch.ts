import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getGearItem, getPerkWeapons, searchGear } from '../lib/api';
import type { GearSearchDto, JsonRecord } from '../lib/types';
import { formatNumber } from '../lib/format';
import { readUrlSearchParam } from './useMountUrlParam';

export function useGearSearch() {
  const [query, setQuery] = useState(() => readUrlSearchParam('q') || '');
  const [payload, setPayload] = useState<GearSearchDto | null>(null);
  const [detail, setDetail] = useState<JsonRecord | null>(null);
  const [subtitle, setSubtitle] = useState('输入名称查询，点击结果查看详情');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);

  const runSearch = useCallback(async (rawQuery: string) => {
    const value = rawQuery.trim();
    if (!value) {
      setNotice('请输入武器、护甲或 Perk 名称。');
      setError(true);
      return;
    }
    setNotice('');
    setError(false);
    setPayload(null);
    setDetail({ loading: true, message: '首次加载索引可能需要几秒' });
    setSubtitle('装备索引查询中');
    try {
      const data = await searchGear(value);
      setPayload(data);
      setDetail(null);
      setSubtitle(`统一搜索 · ${formatNumber(data.total || 0)} 条 · ${gearCacheLabel(data.cache?.gearIndex)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '装备搜索失败';
      setNotice(message);
      setError(true);
      setDetail(null);
      setSubtitle('装备搜索');
    }
  }, []);

  useEffect(() => {
    const initial = readUrlSearchParam('q');
    if (initial) void runSearch(initial);
  }, [runSearch]);

  const openItem = useCallback(async (item: JsonRecord) => {
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
    subtitle,
    notice,
    error,
    runSearch,
    openItem,
    onSubmit
  };
}

function gearCacheLabel(status?: string) {
  if (!status) return '索引缓存';
  if (String(status).includes('hit')) return '索引缓存命中';
  return '索引已读取';
}
