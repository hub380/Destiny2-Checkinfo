import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

type RecentQueryChipsProps = {
  items: string[];
  onPick: (value: string) => void;
  label?: string;
};

export function RecentQueryChips({ items, onPick, label = '最近查询' }: RecentQueryChipsProps) {
  if (!items.length) return null;
  return (
    <div className={cn('recent-queries')} aria-label={label}>
      <span className={cn('recent-queries-label')}>{label}</span>
      <div className={cn('recent-queries-list')}>
        {items.map((item) => (
          <button type="button" className={cn('recent-query-chip')} key={item} onClick={() => onPick(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
