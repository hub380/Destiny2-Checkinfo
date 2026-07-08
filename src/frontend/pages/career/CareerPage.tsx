import React from 'react';

import { BungieQueryPanel } from '@frontend/components/search';

import {

  AppShell,

  FadeIn,

  PageEmpty,

  PageLoading,

  PageSection,

  SkeletonMetricGrid,

  SystemBanner,

  formatTime

} from '@frontend/ui';

import { useCareerSearchFlow, usePublicConfig, useRecentQueries } from '@frontend/hooks';

import {

  COPY_BUNGIE_NAME_EMPTY,

  COPY_CAREER_IDLE_SUBTITLE,

  COPY_CAREER_LOADING

} from '@frontend/lib/copy';

import '@frontend/styles/global.css';

import { CareerDetail } from './CareerDetail';

import { CareerProgressStrip } from './CareerProgressStrip';

import { cn } from './career-cn';



export function CareerPage() {

  const { config, ready } = usePublicConfig();

  const { recent, refresh } = useRecentQueries('career');

  const {

    query,

    setQuery,

    career,

    loading,

    noticeMessage,

    noticeError,

    playerSearch,

    onSubmit,

    selectPlayer,

    runNamedQuery,

    retry,

    autoProgressive,

    progressiveStage,

    loadAllNow

  } = useCareerSearchFlow({

    modes: ['raid', 'dungeon', 'pvp'],

    includeDetails: 'lazy',

    loadEndgame: 'progressive'

  });



  return (

    <AppShell title="Destiny 2 玩家生涯" subtitle="公开生涯 · Raid / 地牢 · PvP · 锻造进度" current="career">

      <FadeIn variant="page" className={cn('career-page')}>

        <SystemBanner hasBungieApiKey={config?.hasBungieApiKey} configReady={ready} />

        <PageSection className={cn('panel career-query-panel panelEnter')}>

          <BungieQueryPanel

            title="玩家查询"

            subtitle={career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : COPY_CAREER_IDLE_SUBTITLE}

            query={query}

            onQueryChange={setQuery}

            playerSearch={playerSearch}

            onSubmit={onSubmit}

            onSelectPlayer={selectPlayer}

            submitting={loading}

            recent={recent}

            onPickRecent={(value) => {

              setQuery(value);

              void runNamedQuery(value);

              refresh();

            }}

            noticeMessage={noticeMessage}

            noticeError={noticeError}

            onRetry={retry}

            wide

            formClassName="career-search career-page-search"

          />

        </PageSection>

        {career && autoProgressive ? (

          <div className={cn('career-progress-sticky')}>

            <CareerProgressStrip

              stage={progressiveStage}

              onLoadAll={loadAllNow}

              busy={progressiveStage !== 'done' && progressiveStage !== 'idle'}

            />

          </div>

        ) : null}

        <section className={cn('career-detail-root')}>

          {career ? (

            <FadeIn variant="detail" className={cn('contentSwap')}>

              <CareerDetail

                career={career}

                progressiveStage={progressiveStage}

                autoProgressive={autoProgressive}

              />

            </FadeIn>

          ) : loading ? (

            <PageLoading className={cn('career-result loading')}>

              {COPY_CAREER_LOADING}

              <SkeletonMetricGrid count={4} />

            </PageLoading>

          ) : (

            <PageEmpty className={cn('career-result')}>{COPY_BUNGIE_NAME_EMPTY}</PageEmpty>

          )}

        </section>

      </FadeIn>

    </AppShell>

  );

}

