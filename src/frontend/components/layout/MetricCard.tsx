import type { ReactNode } from 'react';
import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

export function MetricCard({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className={cn('career-metric-card')}>
      <span>{label}</span>
      <b>{value ?? '-'}</b>
      <em>{note || ''}</em>
    </div>
  );
}
