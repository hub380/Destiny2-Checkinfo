import type { ReactNode } from 'react';
import { css, motionClasses, uiClasses } from '@frontend/lib/cn';
import { Header, type HeaderProps } from './Header';

type AppShellProps = HeaderProps & {
  children: ReactNode;
  toast?: string;
};

const cn = (classNames: string | false | null | undefined) => css([uiClasses, motionClasses], classNames);

export function AppShell({ children, toast, ...header }: AppShellProps) {
  return (
    <div className={cn('app-shell')}>
      <Header {...header} />
      {children}
      <div className={cn(`toast ${toast ? 'show toastEnter' : ''}`)} role="status" aria-live="polite">
        {toast || ''}
      </div>
    </div>
  );
}
