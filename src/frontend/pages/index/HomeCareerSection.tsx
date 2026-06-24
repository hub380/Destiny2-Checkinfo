import type { FormEvent } from 'react';
import { PlayerSearchBox } from '@frontend/components/search';
import type { PlayerSearchState } from '@frontend/hooks';
import { FadeIn, Notice, PageEmpty, PageLoading, PageSection, formatTime } from '@frontend/ui';
import type { CareerSummaryDto } from '@frontend/lib/types';
import {
  COPY_BUNGIE_NAME_EMPTY,
  COPY_BUNGIE_NAME_PLACEHOLDER,
  COPY_HOME_CAREER_IDLE
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
  noticeError
}: HomeCareerSectionProps) {
  return (
    <PageSection id="career" className={cn('panel career-panel')}>
      <div className={cn('panel-header stacked')}>
        <div>
          <h2>棒鸡玩家生涯</h2>
          <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : COPY_HOME_CAREER_IDLE}</p>
        </div>
      </div>
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
      <Notice message={noticeMessage} error={noticeError} />
      {career ? (
        <FadeIn variant="detail" className={cn('contentSwap')}>
          <CompactCareerPanel career={career} />
        </FadeIn>
      ) : loading ? (
        <PageLoading>查询基础资料中</PageLoading>
      ) : (
        <PageEmpty>{COPY_BUNGIE_NAME_EMPTY}</PageEmpty>
      )}
    </PageSection>
  );
}
