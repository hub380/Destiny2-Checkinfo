import type { FormEvent } from 'react';
import { PlayerSearchBox } from '@frontend/components/search';
import type { PlayerSearchState } from '@frontend/hooks';
import { FadeIn, Notice, PageEmpty, PageLoading, PageSection, formatTime } from '@frontend/ui';
import type { CareerSummaryDto } from '@frontend/lib/types';
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
          <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : '公开玩家查询 · 侧栏为简版预览'}</p>
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
        placeholder="搜索棒鸡名称，或输入 名称#数字代码"
      />
      <Notice message={noticeMessage} error={noticeError} />
      {career ? (
        <FadeIn variant="detail" className={cn('contentSwap')}>
          <CompactCareerPanel career={career} />
        </FadeIn>
      ) : loading ? (
        <PageLoading>查询基础资料中</PageLoading>
      ) : (
        <PageEmpty>输入玩家名称开始查询</PageEmpty>
      )}
    </PageSection>
  );
}
