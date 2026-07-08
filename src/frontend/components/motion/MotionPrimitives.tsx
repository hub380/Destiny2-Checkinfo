import type { HTMLAttributes, ReactNode } from 'react';
import { css, motionClasses } from '@frontend/lib/cn';

type FadeInProps = {
  children: ReactNode;
  className?: string;
  variant?: 'layout' | 'panel' | 'detail' | 'page';
};

export function FadeIn({ children, className, variant = 'layout' }: FadeInProps) {
  const motionClass =
    variant === 'panel'
      ? motionClasses.panelEnter
      : variant === 'detail'
        ? motionClasses.detailEnter
        : variant === 'page'
          ? motionClasses.pageEnter
          : motionClasses.layoutEnter;
  return <div className={css(motionClasses, `${motionClass} ${className || ''}`)}>{children}</div>;
}

export function StaggerList({
  children,
  className,
  stagger = true
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
}) {
  const motionClass = stagger ? 'listEnter' : '';
  return <div className={css(motionClasses, `${motionClass} ${className || ''}`)}>{children}</div>;
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
