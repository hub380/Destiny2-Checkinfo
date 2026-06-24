import type { ReactNode } from 'react';
import { LoadingPulse } from '../motion/primitives';
import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string | false | null | undefined) => css(uiClasses, classNames);

type PageStateProps = {
  children: ReactNode;
  className?: string;
};

export function PageEmpty({ children, className }: PageStateProps) {
  return <div className={cn(`state-panel state-empty ${className || ''}`)}>{children}</div>;
}

export function PageLoading({ children, className }: PageStateProps) {
  return (
    <LoadingPulse className={cn(`state-panel state-loading ${className || ''}`)} role="status">
      {children}
    </LoadingPulse>
  );
}
