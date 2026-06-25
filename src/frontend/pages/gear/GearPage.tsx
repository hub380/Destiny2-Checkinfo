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
import type { GearSearchDto, JsonRecord } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import { GearDetailSlot } from './GearDetailViews';
import { cn } from './gear-cn';
import { encounterLabels, gearKindLabel, gearMeta, sourceAliasZh, sourceTypeTag } from './gear-labels';

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

  const items = useMemo(() => Array.isArray(payload?.items) ? payload.items : [], [payload]);
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
                <SearchContextBanner payload={payload} />
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

// ── source type CSS key map ────────────────────────────────────────────────────

const SOURCE_TYPE_CSS: Record<string, string> = {
  '突袭': 'raid', '地牢': 'dungeon', 'PvP': 'pvp',
  '商人': 'vendor', '赛季': 'seasonal', '异域': 'exotic'
};

// ── GearSourceLine ─────────────────────────────────────────────────────────────

function GearSourceLine({ item }: { item: JsonRecord }) {
  const tag = sourceTypeTag(item);
  const source = sourceAliasZh(item);
  const encounters = encounterLabels(item);
  if (!source && !tag) return null;
  return (
    <div className={cn('gear-source-line')}>
      {tag ? (
        <span className={cn(`gear-source-tag gear-source-tag-${SOURCE_TYPE_CSS[tag] || 'other'}`)}>
          {tag}
        </span>
      ) : null}
      {source ? <span className={cn('gear-source-name')}>{source}</span> : null}
      {encounters.length ? (
        <span className={cn('gear-encounter-labels')}>
          {encounters.map((label) => <em key={label}>{label}</em>)}
        </span>
      ) : null}
    </div>
  );
}

// ── SearchContextBanner ────────────────────────────────────────────────────────

const SOURCE_TYPE_LABEL: Record<string, string> = {
  raid: '突袭', dungeon: '地牢', pvp: 'PvP',
  vendor: '商人', seasonal: '赛季', exotic: '异域'
};

function SearchContextBanner({ payload }: { payload: GearSearchDto | null }) {
  if (!payload) return null;
  if (payload.encounter) {
    return (
      <div className={cn('search-context-banner')}>
        <span className={cn('gear-source-tag gear-source-tag-raid')}>关卡搜索</span>
        <b>{payload.encounter.encounterZh || payload.encounter.encounterKey}</b>
        <span className={cn('context-source')}>来自 {payload.encounter.sourceText}</span>
      </div>
    );
  }
  if (payload.source) {
    const typeLabel = SOURCE_TYPE_LABEL[payload.source.sourceType] || '来源';
    return (
      <div className={cn('search-context-banner')}>
        <span className={cn(`gear-source-tag gear-source-tag-${payload.source.sourceType || 'other'}`)}>
          {typeLabel}
        </span>
        <b>{payload.source.sourceZh || payload.source.sourceText}</b>
      </div>
    );
  }
  return null;
}

// ── GearResultCard ─────────────────────────────────────────────────────────────

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
        <GearSourceLine item={item} />
        <div className={cn('gear-card-foot')}>
          <b>{action}</b>
        </div>
      </div>
  </button>
)
}
