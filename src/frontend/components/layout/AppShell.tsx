import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { css, motionClasses, uiClasses } from '@frontend/lib/cn';
import { initTheme } from '@frontend/hooks/useTheme';
import { Header, type HeaderProps } from './Header';

initTheme();

type AppShellProps = HeaderProps & {
  children: ReactNode;
  toast?: string;
};

const cn = (classNames: string | false | null | undefined) => css([uiClasses, motionClasses], classNames);

const PREFETCH_PAGES = ['career', 'gear', 'fireteam', 'guides'] as const;

function prefetchSiblingPages(current: HeaderProps['current']) {
  if (typeof document === 'undefined') return;
  const targets = current === 'home'
    ? PREFETCH_PAGES
    : PREFETCH_PAGES.filter((page) => page !== current);
  for (const page of targets) {
    const href = `/${page}.html`;
    if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }
}

export function AppShell({ children, toast, ...header }: AppShellProps) {
  useEffect(() => {
    const schedule = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1200));
    const id = schedule(() => prefetchSiblingPages(header.current));
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, [header.current]);

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
