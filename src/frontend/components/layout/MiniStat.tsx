import type { ReactNode } from 'react';
import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={cn('career-mini-stat')}>
      <span>{label}</span>
      <b>{value ?? '-'}</b>
    </div>
  );
}
