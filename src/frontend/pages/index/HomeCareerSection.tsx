import type { FormEvent } from 'react';
import { PlayerSearchBox, RecentQueryChips } from '@frontend/components/search';
import type { PlayerSearchState } from '@frontend/hooks';
import {
  ActionNotice,
  FadeIn,
  PageEmpty,
  PageLoading,
  PageSection,
  SkeletonMetricGrid,
  formatTime
} from '@frontend/ui';
import type { CareerSummaryDto } from '@frontend/lib/types';
import {
  COPY_BUNGIE_NAME_EMPTY,
  COPY_BUNGIE_NAME_PLACEHOLDER,
  COPY_HOME_CAREER_IDLE,
  COPY_HOME_SUMMARY_NOTE
} from '@frontend/lib/copy';
import { CompactCareerPanel } from './CompactCareerPanel';
import { cn } from './home-cn';

type HomeCareerSectionProps = {
  query: string;
  onQueryChange: (value: string) => void;
  playerSearch: PlayerSearchState;
  onSubmit: (event: FormEvent) => void;
  onSelectPlayer: (player: import('@frontend/lib/types').PlayerSearchItemDto) => void;
  career: CareerSummaryDto | null;
  loading: boolean;
  noticeMessage: string;
  noticeError: boolean;
  recentQueries?: string[];
  onPickRecent?: (value: string) => void;
  onRetry?: () => void;
  pendingPick?: string | null;
  onPickCareer?: () => void;
  onPickFireteam?: () => void;
  onDismissPick?: () => void;
};

export function HomeCareerSection({
  query,
  onQueryChange,
  playerSearch,
  onSubmit,
  onSelectPlayer,
  career,
  loading,
  noticeMessage,
  noticeError,
  recentQueries = [],
  onPickRecent,
  onRetry,
  pendingPick,
  onPickCareer,
  onPickFireteam,
  onDismissPick
}: HomeCareerSectionProps) {
  return (
    <PageSection id="career" className={cn('panel career-panel panelEnter')}>
      <div className={cn('panel-header stacked')}>
        <div>
          <h2>棒鸡玩家生涯</h2>
          <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : COPY_HOME_CAREER_IDLE}</p>
        </div>
      </div>
      {pendingPick ? (
        <div className={cn('pick-choice')} role="status">
          <p>
            已选择 <b>{pendingPick}</b>，要查什么？
          </p>
          <div className={cn('pick-choice-actions')}>
            <button type="button" onClick={onPickCareer}>查公开生涯</button>
            <button type="button" onClick={onPickFireteam}>查棒鸡队伍</button>
            <button type="button" className={cn('pick-dismiss')} onClick={onDismissPick}>取消</button>
          </div>
        </div>
      ) : null}
      <PlayerSearchBox
        query={query}
        onQueryChange={onQueryChange}
        search={playerSearch}
        onSubmit={onSubmit}
        onSelectPlayer={onSelectPlayer}
        submitting={loading}
        formClassName="career-search"
        placeholder={COPY_BUNGIE_NAME_PLACEHOLDER}
      />
      <RecentQueryChips items={recentQueries} onPick={(value) => onPickRecent?.(value)} />
      <ActionNotice message={noticeMessage} error={noticeError} onRetry={noticeError ? onRetry : undefined} />
      {career ? (
        <FadeIn variant="detail" className={cn('contentSwap')}>
          <p className={cn('summary-note')}>{COPY_HOME_SUMMARY_NOTE}</p>
          <CompactCareerPanel career={career} />
        </FadeIn>
      ) : loading ? (
        <PageLoading>
          查询基础资料中
          <SkeletonMetricGrid count={3} />
        </PageLoading>
      ) : (
        <PageEmpty>{COPY_BUNGIE_NAME_EMPTY}</PageEmpty>
      )}
    </PageSection>
  );
}
