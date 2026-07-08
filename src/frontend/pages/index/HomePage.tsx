import React, { useEffect, useMemo, useState } from 'react';
import { copyToClipboard } from '@frontend/lib/clipboard';
import {
  AppShell,
  FadeIn,
  GitHubBranchLink,
  PageSection,
  RefreshIcon,
  SystemBanner,
  formatTime
} from '@frontend/ui';
import { useHeyboxFeed, useCareerSearchFlow, usePublicConfig, useRecentQueries } from '@frontend/hooks';
import '@frontend/styles/global.css';
import { FireteamFeedSection } from './FireteamFeedSection';
import { HomeCareerSection } from './HomeCareerSection';
import { cn } from './home-cn';

const REFRESH_INTERVAL_STORAGE_KEY = 'fireteam-refresh-interval';
const REFRESH_INTERVAL_OPTIONS = [10, 15, 30] as const;
const DEFAULT_REFRESH_SECONDS = 30;

export function HomePage() {
  const [refreshSeconds, setRefreshSeconds] = useState(readStoredRefreshInterval);
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const { config, ready: configReady } = usePublicConfig();
  const { recent: homeRecent, refresh: refreshHomeRecent } = useRecentQueries('home');
  const {
    items,
    payload,
    notice,
    noticeError,
    loading,
    autoRefresh,
    setAutoRefresh,
    countdown,
    refresh: refreshFireteams,
    reportNotice
  } = useHeyboxFeed(refreshSeconds);
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState('');
  const {
    query: careerQuery,
    setQuery: setCareerQuery,
    career,
    loading: careerLoading,
    noticeMessage: careerNotice,
    noticeError: careerError,
    playerSearch,
    onSubmit: queryCareer,
    selectPlayer: selectCareerPlayer,
    pickUsername,
    runNamedQuery,
    retry: retryCareer
  } = useCareerSearchFlow({
    modes: [],
    includeDetails: false,
    loadEndgame: 'none',
    recentScope: 'home'
  });

  useEffect(() => {
    if (configReady && !config) {
      reportNotice('配置加载失败', true);
    }
  }, [config, configReady, reportNotice]);

  const filteredItems = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.title, item.content, item.activity, item.author, item.username, ...(item.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [filter, items]);

  async function copyJoinCommand(command: string) {
    await copyToClipboard(command);
    showToast(`已复制 ${command}`);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  }

  function updateRefreshInterval(value: number) {
    const nextValue = normalizeRefreshInterval(value);
    setRefreshSeconds(nextValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(nextValue));
    }
    showToast(`刷新间隔已设为 ${nextValue} 秒`);
  }

  function handlePickUser(username: string) {
    if (!username) return;
    if (!username.includes('#')) {
      pickUsername(username);
      setPendingPick(null);
      return;
    }
    setPendingPick(username);
    setCareerQuery(username);
    document.getElementById('career')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function queryPickedCareer() {
    if (!pendingPick) return;
    await runNamedQuery(pendingPick);
    setPendingPick(null);
  }

  function openPickedFireteam() {
    if (!pendingPick) return;
    window.location.href = `/fireteam.html?q=${encodeURIComponent(pendingPick)}`;
  }

  const isDemo = payload?.source === 'demo';

  return (
    <AppShell
      title="Destiny 2 组队监控"
      subtitle="小黑盒组队 · 棒鸡公开生涯"
      current="home"
      toast={toast}
      toolbar={
        <div className={cn('toolbar')}>
          <span className={cn(`status-pill ${isDemo ? 'demo' : payload ? 'ready' : 'warn'}`)}>
            {isDemo ? '演示数据' : payload ? '已连接' : '连接中'}
          </span>
          <span className={cn('status-text')}>{payload?.updatedAt ? `更新 ${formatTime(payload.updatedAt)}` : '尚未刷新'}</span>
          <label className={cn('switch')} title="自动刷新">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => {
                setAutoRefresh(event.target.checked);
                showToast(event.target.checked ? '自动刷新已开启' : '自动刷新已关闭');
              }}
            />
            <span></span>
            <b>{autoRefresh ? `${countdown || refreshSeconds}s` : 'off'}</b>
          </label>
          <label className={cn('refresh-interval')} title="刷新间隔">
            <span>间隔</span>
            <select
              value={refreshSeconds}
              onChange={(event) => updateRefreshInterval(Number(event.target.value))}
              aria-label="组队信息刷新间隔"
            >
              {REFRESH_INTERVAL_OPTIONS.map((seconds) => (
                <option value={seconds} key={seconds}>{seconds}s</option>
              ))}
            </select>
          </label>
          <button
            className={cn(`icon-button spinOnRefresh ${loading ? 'isSpinning' : ''}`)}
            title="刷新"
            onClick={refreshFireteams}
            disabled={loading}
          >
            <RefreshIcon />
          </button>
          <GitHubBranchLink />
        </div>
      }
    >
      <FadeIn variant="page" className={cn('layout')}>
        <SystemBanner
          hasBungieApiKey={config?.hasBungieApiKey}
          demoData={isDemo}
          configReady={configReady}
        />
        <PageSection id="fireteams" className={cn('panel fireteams-panel')}>
          <FireteamFeedSection
            items={items}
            filteredItems={filteredItems}
            filter={filter}
            loading={loading}
            notice={notice}
            noticeError={noticeError}
            onFilterChange={setFilter}
            onCopy={copyJoinCommand}
            onPickUser={handlePickUser}
            onRetry={refreshFireteams}
          />
        </PageSection>

        <HomeCareerSection
          query={careerQuery}
          onQueryChange={setCareerQuery}
          playerSearch={playerSearch}
          onSubmit={queryCareer}
          onSelectPlayer={selectCareerPlayer}
          career={career}
          loading={careerLoading}
          noticeMessage={careerNotice}
          noticeError={careerError}
          recentQueries={homeRecent}
          onPickRecent={(value) => {
            setCareerQuery(value);
            void runNamedQuery(value);
            refreshHomeRecent();
          }}
          onRetry={retryCareer}
          pendingPick={pendingPick}
          onPickCareer={() => void queryPickedCareer()}
          onPickFireteam={openPickedFireteam}
          onDismissPick={() => setPendingPick(null)}
        />
      </FadeIn>
    </AppShell>
  );
}

function readStoredRefreshInterval() {
  if (typeof window === 'undefined') return DEFAULT_REFRESH_SECONDS;
  return normalizeRefreshInterval(Number(window.localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY)));
}

function normalizeRefreshInterval(value: number) {
  return REFRESH_INTERVAL_OPTIONS.includes(value as (typeof REFRESH_INTERVAL_OPTIONS)[number])
    ? value
    : DEFAULT_REFRESH_SECONDS;
}
