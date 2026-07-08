import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn(`skeleton-block ${className || ''}`)} aria-hidden="true" />;
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('skeleton-metric-grid')}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} className="skeleton-metric" />
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className={cn('skeleton-card-grid')}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} className="skeleton-card" />
      ))}
    </div>
  );
}
