import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getCareerSummary, getConfig, getEndgame, getFireteams } from '../api';
import type { CareerSummaryDto, FireteamDto, FireteamsResponseDto } from '../types';
import { BRAND_LOGO, CopyIcon, Notice, RefreshIcon, SearchIcon, css, formatMinutes, formatTime, relativeTime, statDisplay, uiClasses } from '../ui';
import '../global.css';
import styles from './home.module.css';

const REFRESH_SECONDS = 30;
const cn = (classNames: string | false | null | undefined) => css([uiClasses, styles], classNames);

function HomePage() {
  const [items, setItems] = useState<FireteamDto[]>([]);
  const [payload, setPayload] = useState<FireteamsResponseDto | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [careerQuery, setCareerQuery] = useState('');
  const [career, setCareer] = useState<CareerSummaryDto | null>(null);
  const [careerNotice, setCareerNotice] = useState('');
  const [careerError, setCareerError] = useState(false);
  const nextRefreshAt = useRef(Date.now() + REFRESH_SECONDS * 1000);
  const refreshTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    getConfig().catch((error) => {
      setNotice(error.message);
      setNoticeError(true);
    });
    refreshFireteams();
    return () => window.clearTimeout(refreshTimer.current);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!autoRefresh) {
        setCountdown(0);
        return;
      }
      setCountdown(Math.max(Math.ceil((nextRefreshAt.current - Date.now()) / 1000), 0));
    }, 500);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    window.clearTimeout(refreshTimer.current);
    if (!autoRefresh) return;
    const delay = Math.max(nextRefreshAt.current - Date.now(), 1000);
    refreshTimer.current = window.setTimeout(refreshFireteams, delay);
    return () => window.clearTimeout(refreshTimer.current);
  }, [autoRefresh, payload?.updatedAt]);

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

  async function refreshFireteams() {
    if (loading) return;
    setLoading(true);
    setNotice('');
    try {
      const data = await getFireteams();
      setPayload(data);
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.warning) {
        setNotice(data.warning);
        setNoticeError(false);
      }
      nextRefreshAt.current = Date.now() + REFRESH_SECONDS * 1000;
    } catch (error: any) {
      setNotice(error.message);
      setNoticeError(true);
    } finally {
      setLoading(false);
    }
  }

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
    setCareer(null);
    setCareerNotice('');
    setCareerError(false);
    try {
      const summary = await getCareerSummary(bungieName);
      setCareer({ ...summary, endgameLoading: { raid: true, dungeon: true } });
      setCareerNotice('Raid / 地牢完整历史加载中，基础资料已先展示。');
      const baseRequest = {
        membershipType: summary.account.membershipType,
        membershipId: summary.account.membershipId,
        characters: summary.characters
      };
      const [raid, dungeon] = await Promise.all([
        getEndgame({ ...baseRequest, mode: 'raid' }),
        getEndgame({ ...baseRequest, mode: 'dungeon' })
      ]);
      setCareer((current) => mergeEndgameCareer(mergeEndgameCareer(current || summary, raid), dungeon));
      setCareerNotice('');
    } catch (error: any) {
      setCareerError(true);
      setCareerNotice(error.message);
    }
  }

  const isDemo = payload?.source === 'demo';

  return (
    <div className={cn('app-shell')}>
      <header className={cn('topbar')}>
        <div className={cn('brand')}>
          <img src={BRAND_LOGO} alt="" className={cn('brand-mark')} />
          <div>
            <h1>Destiny 2 组队监控</h1>
            <p>小黑盒组队 · 棒鸡公开生涯</p>
          </div>
        </div>
        <nav className={cn('main-nav')} aria-label="主导航">
          <a href="#fireteams" className={cn('current')}>组队</a>
          <a href="/career.html">玩家生涯</a>
          <a href="/gear.html">装备搜索</a>
          <a href="/guides.html">攻略/资讯</a>
        </nav>
        <div className={cn('toolbar')}>
          <span className={cn(`status-pill ${isDemo ? 'demo' : payload ? 'ready' : 'warn'}`)}>{isDemo ? '演示数据' : payload ? '已连接' : '连接中'}</span>
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
          <button className={cn('icon-button')} title="刷新" onClick={refreshFireteams} disabled={loading}>
            <RefreshIcon />
          </button>
        </div>
      </header>

      <main className={cn('layout')}>
        <section className={cn('panel fireteams-panel')} id="fireteams">
          <div className={cn('panel-header')}>
            <div>
              <h2>组队信息</h2>
              <p>{loading ? '刷新中' : `${filteredItems.length} 条 / 共 ${items.length} 条`}</p>
            </div>
            <div className={cn('filter-box')}>
              <SearchIcon />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} type="search" placeholder="筛选活动、队长、用户名" />
            </div>
          </div>
          <Notice message={notice} error={noticeError} />
          <div className={cn('fireteam-list')}>
            {filteredItems.length ? (
              filteredItems.map((item, index) => (
                <FireteamCard
                  key={item.id || index}
                  item={item}
                  onCopy={copyJoinCommand}
                  onPickUser={(username) => setCareerQuery(username)}
                />
              ))
            ) : (
              <div className={cn('career-result empty')}>没有匹配的组队信息</div>
            )}
          </div>
        </section>

        <aside className={cn('panel career-panel')} id="career">
          <div className={cn('panel-header stacked')}>
            <div>
              <h2>棒鸡玩家生涯</h2>
              <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : '公开玩家查询'}</p>
            </div>
          </div>
          <form className={cn('career-search')} onSubmit={queryCareer}>
            <input value={careerQuery} onChange={(event) => setCareerQuery(event.target.value)} autoComplete="off" spellCheck={false} placeholder="输入棒鸡 ID：名称#数字代码" />
            <button type="submit">
              <SearchIcon />
              查询
            </button>
          </form>
          <Notice message={careerNotice} error={careerError} />
          {career ? <CompactCareer career={career} /> : <div className={cn('career-result empty')}>暂无查询结果</div>}
        </aside>
      </main>
      <div className={cn(`toast ${toast ? 'show' : ''}`)}>{toast}</div>
    </div>
  );
}

function FireteamCard({ item, onCopy, onPickUser }: { item: FireteamDto; onCopy: (command: string) => void; onPickUser: (username: string) => void }) {
  const username = item.username || '';
  const command = item.joinCommand || (username ? `/j ${username}` : '');
  const meta = [item.activity, item.author ? `队长 ${item.author}` : '', item.createdAt ? relativeTime(item.createdAt) : '', item.source === 'demo' ? '演示' : ''].filter(Boolean).join(' · ');
  return (
    <article className={cn('fireteam-card')}>
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
      <div className={cn('character-list')}>
        {(career.characters || []).map((character) => (
          <div className={cn('character')} key={character.id}>
            <img src={character.emblemPath || '/brand.svg'} alt="" />
            <div>
              <b>{character.className}</b>
              <span>{[character.raceName, character.genderName].filter(Boolean).join(' · ')}</span>
            </div>
            <div className={cn('power')}>{character.light || '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function mergeEndgameCareer(career: CareerSummaryDto, payload: any): CareerSummaryDto {
  const endgame = payload.endgame || payload;
  const loading = career.endgameLoading && typeof career.endgameLoading === 'object' ? { ...career.endgameLoading } : { raid: false, dungeon: false };
  for (const mode of Object.keys(endgame)) {
    if (mode === 'raid' || mode === 'dungeon') loading[mode] = false;
  }
  return {
    ...career,
    endgameLoading: loading.raid || loading.dungeon ? loading : false,
    endgame: { ...(career.endgame || {}), ...endgame },
    stats: {
      ...(career.stats || {}),
      ...(payload.statsPatch?.raid ? { raid: payload.statsPatch.raid } : {}),
      ...(payload.statsPatch?.dungeon ? { dungeon: payload.statsPatch.dungeon } : {})
    },
    cache: { ...(career.cache || {}), ...(payload.cache || {}) }
  };
}

function statTile(label: string, value: any) {
  return (
    <div className={cn('stat-tile')}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<HomePage />);
