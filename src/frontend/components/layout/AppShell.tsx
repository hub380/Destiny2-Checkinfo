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
      <a className={cn('skip-link')} href="#main-content">跳到主要内容</a>
      <Header {...header} />
      <main id="main-content">{children}</main>
      <div className={cn(`toast ${toast ? 'show toastEnter' : ''}`)} role="status" aria-live="polite">
        {toast || ''}
      </div>
    </div>
  );
}
