import React, { useEffect, useMemo, useState } from 'react';
import { getConfig } from '@frontend/lib/api';
import { copyToClipboard } from '@frontend/lib/clipboard';
import { AppShell, FadeIn, GitHubBranchLink, PageSection, RefreshIcon, formatTime } from '@frontend/ui';
import { useHeyboxFeed, useCareerSearchFlow } from '@frontend/hooks';
import '@frontend/styles/global.css';
import { FireteamFeedSection } from './FireteamFeedSection';
import { HomeCareerSection } from './HomeCareerSection';
import { cn } from './home-cn';

const REFRESH_SECONDS = 30;

export function HomePage() {
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
  } = useHeyboxFeed(REFRESH_SECONDS);
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
    pickUsername: pickFireteamUser
  } = useCareerSearchFlow({
    modes: ['raid', 'dungeon'],
    includeDetails: false,
    loadingNotice: 'Raid / 地牢完整历史加载中，基础资料已先展示。'
  });

  useEffect(() => {
    getConfig().catch((error) => {
      reportNotice(error instanceof Error ? error.message : '配置加载失败', true);
    });
  }, [reportNotice]);

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
            <b>{autoRefresh ? `${countdown || REFRESH_SECONDS}s` : 'off'}</b>
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
            onPickUser={pickFireteamUser}
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
        />
      </FadeIn>
    </AppShell>
  );
}
