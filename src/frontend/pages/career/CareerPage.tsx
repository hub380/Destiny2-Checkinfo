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
import {
  COPY_BUNGIE_NAME_EMPTY,
  COPY_CAREER_IDLE_SUBTITLE,
  COPY_CAREER_LOADING
} from '@frontend/lib/copy';
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
              <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : COPY_CAREER_IDLE_SUBTITLE}</p>
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
            <PageLoading className={cn('career-result loading')}>{COPY_CAREER_LOADING}</PageLoading>
          ) : (
            <PageEmpty className={cn('career-result')}>{COPY_BUNGIE_NAME_EMPTY}</PageEmpty>
          )}
        </section>
      </FadeIn>
    </AppShell>
  );
}
