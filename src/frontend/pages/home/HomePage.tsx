import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { getConfig } from '@frontend/lib/api';
import {
  AppShell,
  CopyIcon,
  FadeIn,
  GitHubBranchLink,
  LoadingPulse,
  Notice,
  RefreshIcon,
  SearchIcon,
  StaggerList,
  createPageCn,
  formatMinutes,
  formatTime,
  relativeTime,
  staggerStyle,
  statDisplay
} from '@frontend/ui';
import { useCareerQuery, useFireteamFeed } from '@frontend/hooks';
import type { CareerSummaryDto, FireteamDto } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import styles from './home.module.css';
const REFRESH_SECONDS = 30;
const cn = createPageCn(styles);

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
  } = useFireteamFeed(REFRESH_SECONDS);
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState('');
  const [careerQuery, setCareerQuery] = useState('');
  const { career, loading: careerLoading, error: careerError, query: runCareerQuery } = useCareerQuery({
    modes: ['raid', 'dungeon'],
    includeDetails: false
  });
  const [careerNotice, setCareerNotice] = useState('');

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
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const input = document.createElement('textarea');
      input.value = command;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    showToast(`已复制 ${command}`);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  }

  async function queryCareer(event: FormEvent) {
    event.preventDefault();
    const bungieName = careerQuery.trim();
    if (!bungieName) return;
    setCareerNotice('Raid / 地牢完整历史加载中，基础资料已先展示。');
    const result = await runCareerQuery(bungieName);
    setCareerNotice(result.ok ? '' : result.error || '查询失败');
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
      <FadeIn className={cn('layout')}>
        <section className={cn('panel fireteams-panel panelEnter')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>组队信息</h2>
              <p>{loading ? '刷新中' : `${filteredItems.length} 条 / 共 ${items.length} 条`}</p>
            </div>
            <div className={cn('filter-box searchFocus')}>
              <SearchIcon />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} type="search" placeholder="筛选活动、队长、用户名" />
            </div>
          </div>
          <Notice message={notice} error={noticeError} />
          <StaggerList className={cn(`fireteam-list ${loading ? 'is-loading' : ''}`)}>
            {filteredItems.length ? (
              filteredItems.map((item, index) => (
                <FireteamCard
                  key={item.id || index}
                  item={item}
                  index={index}
                  onCopy={copyJoinCommand}
                  onPickUser={(username) => setCareerQuery(username)}
                />
              ))
            ) : (
              <div className={cn('career-result empty')}>没有匹配的组队信息</div>
            )}
          </StaggerList>
        </section>

        <aside className={cn('panel career-panel panelEnter')}>
          <div className={cn('panel-header stacked')}>
            <div>
              <h2>棒鸡玩家生涯</h2>
              <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : '公开玩家查询'}</p>
            </div>
          </div>
          <form className={cn('career-search searchFocus')} onSubmit={queryCareer}>
            <input
              value={careerQuery}
              onChange={(event) => setCareerQuery(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="输入棒鸡 ID：名称#数字代码"
            />
            <button type="submit">
              <SearchIcon />
              查询
            </button>
          </form>
          <Notice message={careerNotice || careerError} error={Boolean(careerError)} />
          {career ? (
            <FadeIn variant="detail" className={cn('contentSwap')}>
              <CompactCareer career={career} />
            </FadeIn>
          ) : careerLoading ? (
            <LoadingPulse className={cn('career-result empty')}>查询基础资料中</LoadingPulse>
          ) : (
            <div className={cn('career-result empty')}>暂无查询结果</div>
          )}
        </aside>
      </FadeIn>
    </AppShell>
  );
}

function FireteamCard({
  item,
  index,
  onCopy,
  onPickUser
}: {
  item: FireteamDto;
  index: number;
  onCopy: (command: string) => void;
  onPickUser: (username: string) => void;
}) {
  const username = item.username || '';
  const command = item.joinCommand || (username ? `/j ${username}` : '');
  const meta = [item.activity, item.author ? `队长 ${item.author}` : '', item.createdAt ? relativeTime(item.createdAt) : '', item.source === 'demo' ? '演示' : ''].filter(Boolean).join(' · ');
  return (
    <article className={cn('fireteam-card cardHover staggerItem')} style={staggerStyle(index)}>
      <div className={cn('fireteam-main')}>
        <div className={cn('fireteam-head')}>
          <img className={cn('team-avatar')} src={item.avatar || '/brand.svg'} alt="" />
          <div className={cn('fireteam-copy')}>
            <div className={cn('fireteam-title')}>
              <h3>{item.title || '未命名组队'}</h3>
              {item.slots?.max ? <span className={cn('slot')}>{item.slots.current}/{item.slots.max}</span> : null}
            </div>
            <div className={cn('meta-row')}>{meta || '小黑盒'}</div>
          </div>
        </div>
        {item.tags?.length ? <div className={cn('tag-row')}>{item.tags.slice(0, 4).map((tag) => <span className={cn('tag')} key={tag}>{tag}</span>)}</div> : null}
        <p className={cn('content')}>{item.content || '无详情'}</p>
      </div>
      <div className={cn('join-box')}>
        <button className={cn(`username ${username ? 'clickable' : ''}`)} type="button" onClick={() => username && onPickUser(username)}>
          {username || '未识别用户名'}
        </button>
        <button className={cn('copy-button')} disabled={!command} onClick={() => command && onCopy(command)}>
          <CopyIcon />
          复制
        </button>
        {item.link ? <a className={cn('tag')} href={item.link} target="_blank" rel="noreferrer">来源</a> : null}
      </div>
    </article>
  );
}

function CompactCareer({ career }: { career: CareerSummaryDto }) {
  const stats = career.stats || {};
  const pvp = stats.pvp || {};
  const raid = career.endgame?.raid || stats.raid || {};
  const dungeon = career.endgame?.dungeon || stats.dungeon || {};
  const raidTotal = raid.total || raid;
  const dungeonTotal = dungeon.total || dungeon;
  return (
    <div className={cn('career-result')}>
      <div className={cn('account-head')}>
        <h3>{career.account.displayName}</h3>
        <p>{career.account.membershipTypeName} · {career.account.membershipId}</p>
      </div>
      <div className={cn('stat-grid')}>
        {statTile('守护者等级', career.profile?.guardianRank || '-')}
        {statTile('最高光等', career.profile?.maxLight || '-')}
        {statTile('总时长', formatMinutes(career.profile?.totalMinutesPlayed))}
        {statTile('角色数', career.profile?.characterCount || 0)}
        {statTile('Raid 完成', statDisplay(raidTotal.clears))}
        {statTile('地牢完成', statDisplay(dungeonTotal.clears))}
        {statTile('PvP 胜场', statDisplay(pvp.activitiesWon))}
      </div>
      <div className={cn('section-title')}>角色</div>
      <StaggerList className={cn('character-list')}>
        {(career.characters || []).map((character, index) => (
          <div className={cn('character staggerItem')} key={character.id} style={staggerStyle(index)}>
            <img src={character.emblemPath || '/brand.svg'} alt="" />
            <div>
              <b>{character.className}</b>
              <span>{[character.raceName, character.genderName].filter(Boolean).join(' · ')}</span>
            </div>
            <div className={cn('power')}>{character.light || '-'}</div>
          </div>
        ))}
      </StaggerList>
    </div>
  );
}

function statTile(label: string, value: React.ReactNode) {
  return (
    <div className={cn('stat-tile')}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

