import type { HTMLAttributes, ReactNode } from 'react';
import { css, motionClasses } from '@frontend/lib/cn';

type FadeInProps = {
  children: ReactNode;
  className?: string;
  variant?: 'layout' | 'panel' | 'detail';
};

export function FadeIn({ children, className, variant = 'layout' }: FadeInProps) {
  const motionClass =
    variant === 'panel' ? motionClasses.panelEnter : variant === 'detail' ? motionClasses.detailEnter : motionClasses.layoutEnter;
  return <div className={css(motionClasses, `${motionClass} ${className || ''}`)}>{children}</div>;
}

export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={css(motionClasses, `listEnter ${className || ''}`)}>{children}</div>;
}

export function LoadingPulse({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={css(motionClasses, `loadingPulse ${className || ''}`)} role="status" aria-live="polite" {...rest}>
      {children}
    </div>
  );
}
