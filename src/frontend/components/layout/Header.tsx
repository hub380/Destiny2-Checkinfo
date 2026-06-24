import type { ReactNode } from 'react';
import { css, uiClasses } from '@frontend/lib/cn';
import { BRAND_LOGO } from '@frontend/lib/constants';
import { GitHubBranchLink } from './GitHubBranchLink';

const cn = (classNames: string | false | null | undefined) => css(uiClasses, classNames);

export type HeaderProps = {
  title: string;
  subtitle: string;
  current: 'home' | 'career' | 'gear' | 'fireteam' | 'guides';
  toolbar?: ReactNode;
};

export function Header({ title, subtitle, current, toolbar }: HeaderProps) {
  return (
    <header className={cn('topbar')}>
      <div className={cn('brand')}>
        <img src={BRAND_LOGO} alt="" className={cn('brand-mark')} />
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <nav className={cn('main-nav')} aria-label="主导航">
        <a href="/#fireteams" className={cn(current === 'home' ? 'current' : '')}>小黑盒组队</a>
        <a href="/career.html" className={cn(current === 'career' ? 'current' : '')}>玩家生涯</a>
        <a href="/gear.html" className={cn(current === 'gear' ? 'current' : '')}>装备搜索</a>
        <a href="/fireteam.html" className={cn(current === 'fireteam' ? 'current' : '')}>棒鸡队伍</a>
        <a href="/guides.html" className={cn(current === 'guides' ? 'current' : '')}>攻略/资讯</a>
      </nav>
      {toolbar ?? <GitHubBranchLink />}
    </header>
  );
}
