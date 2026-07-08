import type { FormEvent, ReactNode } from 'react';
import type { PlayerSearchItemDto } from '@frontend/lib/types';
import type { PlayerSearchState } from '@frontend/hooks';
import { css, uiClasses } from '@frontend/lib/cn';
import { ActionNotice } from '../layout/ActionNotice';
import { PlayerSearchBox } from './PlayerSearchBox';
import { RecentQueryChips } from './RecentQueryChips';

const cn = (classNames: string) => css(uiClasses, classNames);

type BungieQueryPanelProps = {
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (value: string) => void;
  playerSearch: PlayerSearchState;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  onSelectPlayer: (player: PlayerSearchItemDto) => void | Promise<void>;
  submitting?: boolean;
  recent?: string[];
  onPickRecent?: (value: string) => void;
  noticeMessage?: string;
  noticeError?: boolean;
  onRetry?: () => void;
  wide?: boolean;
  formClassName?: string;
  children?: ReactNode;
};

export function BungieQueryPanel({
  title,
  subtitle,
  query,
  onQueryChange,
  playerSearch,
  onSubmit,
  onSelectPlayer,
  submitting = false,
  recent = [],
  onPickRecent,
  noticeMessage = '',
  noticeError = false,
  onRetry,
  wide = false,
  formClassName = 'career-search',
  children
}: BungieQueryPanelProps) {
  return (
    <>
      <div className={cn('panel-header')}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <PlayerSearchBox
        query={query}
        onQueryChange={onQueryChange}
        search={playerSearch}
        onSubmit={onSubmit}
        onSelectPlayer={onSelectPlayer}
        submitting={submitting}
        wide={wide}
        formClassName={formClassName}
      />
      {recent.length && onPickRecent ? <RecentQueryChips items={recent} onPick={onPickRecent} /> : null}
      <ActionNotice message={noticeMessage} error={noticeError} onRetry={noticeError ? onRetry : undefined} />
      {children}
    </>
  );
}
