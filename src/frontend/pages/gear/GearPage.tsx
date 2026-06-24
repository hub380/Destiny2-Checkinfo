import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGearSearch } from '@frontend/hooks';
import {
  AppShell,
  FadeIn,
  Notice,
  PageEmpty,
  PageLoading,
  PageSection,
  SearchIcon,
  StaggerList,
  formatNumber
} from '@frontend/ui';
import {
  COPY_GEAR_EMPTY,
  COPY_GEAR_PLACEHOLDER
} from '@frontend/lib/copy';
import type { JsonRecord } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import { GearDetailSlot } from './GearDetailViews';
import { cn } from './gear-cn';
import { gearKindLabel, gearMeta, primarySourceLabel } from './gear-labels';

const PAGE_SIZE = 24;

export function GearPage() {
  const {
    query,
    setQuery,
    payload,
    detail,
    activeHash,
    subtitle,
    notice,
    error,
    openItem,
    openPerk,
    onSubmit
  } = useGearSearch();
  const [kindFilter, setKindFilter] = useState('all');
  const [page, setPage] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const filteredItems = useMemo(() => {
    if (kindFilter === 'all') return items;
    return items.filter((item) => item.kind === kindFilter);
  }, [items, kindFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleItems = filteredItems.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [payload?.query, kindFilter]);

  useEffect(() => {
    if (!detail || detail.loading || detail.error) return;
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [detail, activeHash]);

  return (
    <AppShell title="Destiny 2 装备搜索" subtitle="统一搜索武器、护甲、Perk 与可出武器" current="gear">
      <FadeIn variant="page" className={cn('layout gear-layout')}>
        <PageSection className={cn('panel gear-panel')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>装备搜索</h2>
              <p>{subtitle}</p>
            </div>
          </div>
          <form className={cn('career-search searchFocus')} onSubmit={onSubmit}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={COPY_GEAR_PLACEHOLDER}
            />
            <button type="submit">
              <SearchIcon />
              查询
            </button>
          </form>
          <Notice message={notice} error={error} />
          {payload ? (
            <div className={cn('chip-tabs gear-kind-tabs')} role="tablist" aria-label="装备类型">
              {[
                { value: 'all', label: '全部' },
                { value: 'weapon', label: '武器' },
                { value: 'armor', label: '护甲' },
                { value: 'perk', label: 'Perk' }
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={kindFilter === tab.value}
                  className={cn(`chip-tab ${kindFilter === tab.value ? 'active' : ''}`)}
                  onClick={() => setKindFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className={cn(`gear-result ${payload ? '' : 'empty'}`)}>
            {!payload ? (
              detail?.loading ? (
                <PageLoading className={cn('detail-loading')}>{detail.message}</PageLoading>
              ) : (
                <PageEmpty>{COPY_GEAR_EMPTY}</PageEmpty>
              )
            ) : (
              <>
                <div className={cn('gear-summary')}>
                  <b>{payload.query}</b>
                  <span>显示 {formatNumber(filteredItems.length)} / {formatNumber(payload.total || 0)}</span>
                </div>
                <div className={cn('gear-detail-slot')} ref={detailRef}>
                  <GearDetailSlot detail={detail} onPerkClick={(perk) => void openPerk(perk)} />
                </div>
                <StaggerList className={cn('gear-grid')} stagger={visibleItems.length <= 20}>
                  {visibleItems.length ? visibleItems.map((item) => (
                    <GearResultCard
                      item={item}
                      active={activeHash === String(item.hash)}
                      onOpen={() => void openItem(item)}
                      key={`${item.kind}-${item.hash}`}
                    />
                  )) : <PageEmpty>没有匹配的装备数据</PageEmpty>}
                </StaggerList>
                {pageCount > 1 ? (
                  <div className={cn('gear-pagination')}>
                    <button type="button" disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>上一页</button>
                    <span>{safePage + 1} / {pageCount}</span>
                    <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>下一页</button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </PageSection>
      </FadeIn>
    </AppShell>
  );
}

function GearResultCard({ item, active, onOpen }: { item: JsonRecord; active?: boolean; onOpen: () => void }) {
  const meta = gearMeta(item);
  const action = item.kind === 'perk' ? '反查武器' : '查看详情';
  return (
    <button className={cn(`gear-card gear-card-button cardHover ${active ? 'active' : ''}`)} type="button" onClick={onOpen}>
      <img className={cn('gear-icon')} src={item.icon || '/brand.svg'} alt="" />
      <div className={cn('gear-main')}>
        <div className={cn('gear-title')}>
          <h3>{item.name || '未知装备'}</h3>
          <span>{gearKindLabel(item.kind)}</span>
        </div>
        {meta.length ? <div className={cn('gear-tags')}>{meta.map((value) => <span className={cn('gear-tag')} key={value}>{value}</span>)}</div> : null}
        {item.description ? <p className={cn('gear-description')}>{item.description}</p> : null}
        {primarySourceLabel(item) ? <p className={cn('gear-source-line')}>来源：{primarySourceLabel(item)}</p> : null}
        <div className={cn('gear-card-foot')}>
          <b>{action}</b>
        </div>
      </div>
    </button>
  );
}
