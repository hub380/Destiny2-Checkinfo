import type { FormEvent } from 'react';
import type { PlayerSearchItemDto } from '@frontend/lib/types';
import { css, uiClasses } from '@frontend/lib/cn';
import type { PlayerSearchState } from '@frontend/hooks';
import { SearchIcon } from '../icons';
import searchStyles from './player-search.module.css';

const cn = (classNames: string | false | null | undefined) => css([uiClasses, searchStyles], classNames);

type PlayerSearchBoxProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  onSelectPlayer: (player: PlayerSearchItemDto) => void | Promise<void>;
  search: PlayerSearchState;
  placeholder?: string;
  submitLabel?: string;
  submitting?: boolean;
  wide?: boolean;
  formClassName?: string;
};

export function PlayerSearchBox({
  query,
  onQueryChange,
  onSubmit,
  onSelectPlayer,
  search,
  placeholder = '搜索棒鸡名称，或输入 名称#数字代码',
  submitLabel = '查询',
  submitting = false,
  wide = false,
  formClassName = 'career-search'
}: PlayerSearchBoxProps) {
  const showResults = search.open && (search.loading || search.notice || search.suggestions.length > 0);

  return (
    <div className={cn(`box ${wide ? 'boxWide' : ''}`)}>
      <form className={cn(`${formClassName} form`)} onSubmit={onSubmit}>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => search.setOpen(true)}
          onKeyDown={search.onSearchKeyDown}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
        />
        <button type="submit" disabled={submitting}>
          <SearchIcon />
          {submitting ? '查询中' : submitLabel}
        </button>
      </form>
      {showResults ? (
        <div className={cn('results')} role="listbox">
          {search.loading ? <div className={cn('state')}>搜索玩家中</div> : null}
          {!search.loading && search.notice ? <div className={cn('state')}>{search.notice}</div> : null}
          {!search.loading
            ? search.suggestions.map((player: PlayerSearchItemDto, index: number) => (
                <button
                  type="button"
                  className={cn(`item ${index === search.activeIndex ? 'itemSelected' : ''}`)}
                  key={`${player.bungieName}-${player.membershipId}`}
                  onMouseEnter={() => search.setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void onSelectPlayer(player)}
                  role="option"
                  aria-selected={index === search.activeIndex}
                >
                  {player.icon ? <img src={player.icon} alt="" /> : <span className={cn('fallback')}>{(player.displayName || player.bungieName).slice(0, 1)}</span>}
                  <span>
                    <b>{player.bungieName}</b>
                    <small>{player.membershipTypeName || 'Destiny'} · {player.displayMembershipName || player.membershipId}</small>
                  </span>
                  <em>{player.isPublic === false ? '隐私' : '公开'}</em>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
