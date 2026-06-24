import React from 'react';
import { PlayerSearchBox } from '@frontend/components/search';
import {
  AppShell,
  FadeIn,
  PageEmpty,
  PageLoading,
  PageSection,
  Notice,
  formatTime
} from '@frontend/ui';
import { useCareerSearchFlow } from '@frontend/hooks';
import '@frontend/styles/global.css';
import { CareerDetail } from './CareerDetailSection';
import { cn } from './career-cn';

export function CareerPage() {
  const {
    query,
    setQuery,
    career,
    loading,
    noticeMessage,
    noticeError,
    playerSearch,
    onSubmit,
    selectPlayer
  } = useCareerSearchFlow({
    modes: ['raid', 'dungeon', 'pvp'],
    includeDetails: true
  });

  return (
    <AppShell title="Destiny 2 玩家生涯" subtitle="公开生涯 · Raid / 地牢 · PvP · 锻造进度" current="career">
      <FadeIn variant="page" className={cn('career-page')}>
        <PageSection className={cn('panel career-query-panel')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>玩家查询</h2>
              <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : '输入棒鸡 ID 查询公开玩家生涯'}</p>
            </div>
          </div>
          <PlayerSearchBox
            query={query}
            onQueryChange={setQuery}
            search={playerSearch}
            onSubmit={onSubmit}
            onSelectPlayer={selectPlayer}
            submitting={loading}
            wide
            formClassName="career-search career-page-search"
          />
          <Notice message={noticeMessage} error={noticeError} />
        </PageSection>
        <section className={cn('career-detail-root')}>
          {career ? (
            <FadeIn variant="detail" className={cn('contentSwap')}>
              <CareerDetail career={career} />
            </FadeIn>
          ) : loading ? (
            <PageLoading className={cn('career-result loading')}>正在查询玩家生涯</PageLoading>
          ) : (
            <PageEmpty className={cn('career-result')}>输入玩家名称开始查询</PageEmpty>
          )}
        </section>
      </FadeIn>
    </AppShell>
  );
}
