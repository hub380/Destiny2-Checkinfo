import type { ReactNode } from 'react';
import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

export function MiniStat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn(`career-mini-stat ${className || ''}`)}>
      <span>{label}</span>
      <b>{value ?? '-'}</b>
    </div>
  );
}
