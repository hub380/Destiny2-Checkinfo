import React, { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getEndgame, getFireteamLookup, searchPlayers } from '../api';
import type { FireteamLookupDto, FireteamMemberLookupDto, PlayerSearchItemDto } from '../types';
import { Header, MetricCard, MiniStat, Notice, SearchIcon, css, dateTime, formatMinutes, formatNumber, statDisplay, uiClasses, winRate } from '../ui';
import '../global.css';
import styles from './fireteam.module.css';

const cn = (classNames: string | false | null | undefined) => css([uiClasses, styles], classNames);

function FireteamPage() {
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<FireteamLookupDto | null>(null);
  const [notice, setNotice] = useState('输入玩家棒鸡 ID，查询该玩家当前公开队伍。');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchItemDto | null>(null);
  const [playerSuggestions, setPlayerSuggestions] = useState<PlayerSearchItemDto[]>([]);
  const [playerSearchNotice, setPlayerSearchNotice] = useState('');
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
      void runQuery({ bungieName: q });
    }
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (!value || value.includes('#') || value.length < 2) {
      setPlayerSuggestions([]);
      setPlayerSearchNotice('');
      setPlayerSearchLoading(false);
      setActiveSuggestionIndex(0);
      return;
    }

    let cancelled = false;
    setSuggestionsOpen(true);
    setPlayerSearchLoading(true);
    setPlayerSearchNotice('');
    const timer = window.setTimeout(() => {
      searchPlayers(value)
        .then((payload) => {
          if (cancelled) return;
          const items = payload.items || [];
          setPlayerSuggestions(items);
          setActiveSuggestionIndex(0);
          setPlayerSearchNotice(items.length ? '' : '没有匹配的棒鸡玩家');
        })
        .catch((err: any) => {
          if (cancelled) return;
          setPlayerSuggestions([]);
          setPlayerSearchNotice(err.message || '玩家搜索失败');
        })
        .finally(() => {
          if (!cancelled) setPlayerSearchLoading(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!lookup?.updatedAt) return;
    const members = (lookup.members || []).filter((member) => !member.error && member.account?.membershipType && member.account?.membershipId && member.characters?.length);
    if (!members.length) return;

    let cancelled = false;
    setLookup((current) => current ? {
      ...current,
      members: (current.members || []).map((member) => members.some((target) => memberKey(target) === memberKey(member)) ? { ...member, endgameLoading: true } : member)
    } : current);

    const load = async () => {
      for (const member of members.slice(0, 6)) {
        try {
          const payload = await getEndgame({
            membershipType: member.account?.membershipType,
            membershipId: member.account?.membershipId,
            characters: member.characters,
            modes: ['raid', 'dungeon']
          });
          if (cancelled) return;
          setLookup((current) => mergeMemberEndgame(current, member, payload));
        } catch (err: any) {
          if (cancelled) return;
          setLookup((current) => markMemberEndgameDone(current, member, err.message || '高难活动数据加载失败'));
        }
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [lookup?.updatedAt]);

  function updateQuery(value: string) {
    setQuery(value);
    if (selectedPlayer?.bungieName !== value) setSelectedPlayer(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setNotice('请输入棒鸡名称，格式为 名称#数字代码，或先输入前缀后选择玩家。');
      setError(true);
      return;
    }
    if (selectedPlayer?.bungieName === value) {
      await runQuery(playerRequest(selectedPlayer));
      return;
    }
    if (!value.includes('#')) {
      const items = await refreshPlayerSuggestions(value);
      setSuggestionsOpen(true);
      setNotice(items.length ? '请选择一个完整的棒鸡 ID 后查询当前队伍。' : '没有匹配的棒鸡玩家。');
      setError(!items.length);
      return;
    }
    await runQuery({ bungieName: value });
  }

  async function refreshPlayerSuggestions(value: string) {
    if (value.length < 2) return [];
    setPlayerSearchLoading(true);
    try {
      const payload = await searchPlayers(value);
      const items = payload.items || [];
      setPlayerSuggestions(items);
      setActiveSuggestionIndex(0);
      setPlayerSearchNotice(items.length ? '' : '没有匹配的棒鸡玩家');
      return items;
    } catch (err: any) {
      setPlayerSearchNotice(err.message || '玩家搜索失败');
      return [];
    } finally {
      setPlayerSearchLoading(false);
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      return;
    }
    if (!suggestionsOpen || !playerSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((index) => Math.min(index + 1, playerSuggestions.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
    }
  }

  async function selectPlayer(player: PlayerSearchItemDto) {
    setSelectedPlayer(player);
    setQuery(player.bungieName);
    setPlayerSuggestions([]);
    setPlayerSearchNotice('');
    setSuggestionsOpen(false);
    await runQuery(playerRequest(player));
  }

  async function runQuery(body: Record<string, any>) {
    const bungieName = String(body.bungieName || query || '').trim();
    if (!bungieName && !body.membershipId) {
      setNotice('请输入棒鸡名称，格式为 名称#数字代码。');
      setError(true);
      return;
    }
    setLoading(true);
    setLookup(null);
    setNotice('正在查询当前队伍和成员生涯数据。');
    setError(false);
    setSuggestionsOpen(false);
    try {
      const payload = await getFireteamLookup({
        ...body,
        bungieName,
        modes: ['raid', 'dungeon']
      });
      setLookup(payload);
      setNotice(payload.message || '查询完成。');
      setError(false);
    } catch (err: any) {
      setNotice(err.message || '队伍查询失败');
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn('app-shell')}>
      <Header title="Destiny 2 队伍查询" subtitle="当前队伍 · 公开生涯对比 · Raid / 地牢 / PvP" current="fireteam" />
      <main className={cn('fireteam-page')}>
        <section className={cn('panel fireteam-query-panel')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>队伍查询</h2>
              <p>{lookup?.updatedAt ? `更新 ${dateTime(lookup.updatedAt)}` : '输入玩家名称前缀选择棒鸡 ID，或直接输入 名称#数字代码'}</p>
            </div>
          </div>
          <div className={cn('player-search-box')}>
            <form className={cn('career-search fireteam-search')} onSubmit={onSubmit}>
              <input value={query} onChange={(event) => updateQuery(event.target.value)} onFocus={() => setSuggestionsOpen(true)} onKeyDown={onSearchKeyDown} autoComplete="off" spellCheck={false} placeholder="搜索棒鸡名称，或输入 名称#数字代码" />
              <button type="submit" disabled={loading}>
                <SearchIcon />
                {loading ? '查询中' : '查询'}
              </button>
            </form>
            {suggestionsOpen && (playerSearchLoading || playerSearchNotice || playerSuggestions.length > 0) ? (
              <div className={cn('player-search-results')} role="listbox">
                {playerSearchLoading ? <div className={cn('player-search-state')}>搜索玩家中</div> : null}
                {!playerSearchLoading && playerSearchNotice ? <div className={cn('player-search-state')}>{playerSearchNotice}</div> : null}
                {!playerSearchLoading ? playerSuggestions.map((player, index) => (
                  <button type="button" className={cn(`player-search-item ${index === activeSuggestionIndex ? 'selected' : ''}`)} key={`${player.bungieName}-${player.membershipId}`} onMouseEnter={() => setActiveSuggestionIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => void selectPlayer(player)} role="option" aria-selected={index === activeSuggestionIndex}>
                    {player.icon ? <img src={player.icon} alt="" /> : <span className={cn('player-search-fallback')}>{(player.displayName || player.bungieName).slice(0, 1)}</span>}
                    <span>
                      <b>{player.bungieName}</b>
                      <small>{player.membershipTypeName || 'Destiny'} · {player.displayMembershipName || player.membershipId}</small>
                    </span>
                    <em>{player.isPublic === false ? '隐私' : '公开'}</em>
                  </button>
                )) : null}
              </div>
            ) : null}
          </div>
          <Notice message={notice} error={error} />
        </section>

        {lookup ? <FireteamResult lookup={lookup} loading={loading} /> : <EmptyState loading={loading} />}
      </main>
    </div>
  );
}

function FireteamResult({ lookup, loading }: { lookup: FireteamLookupDto; loading: boolean }) {
  const members = lookup.members || [];
  return (
    <>
      <section className={cn('fireteam-overview')}>
        <ActivityCard lookup={lookup} />
        <div className={cn('fireteam-metrics')}>
          <MetricCard label="检测成员" value={formatNumber(lookup.summary?.displayedMembers || members.length)} note={`Bungie 返回 ${formatNumber(lookup.summary?.detectedMembers || 0)} 名`} />
          <MetricCard label="资料读取" value={formatNumber(lookup.summary?.resolvedMembers || 0)} note={loading ? '加载中' : '公开资料'} />
          <MetricCard label="加入状态" value={lookup.joinability?.label || '未知'} note={joinabilityNote(lookup.joinability)} />
          <MetricCard label="缓存路径" value={lookup.cache?.transitory || 'live'} note="当前队伍不长缓存" />
        </div>
      </section>

      <section className={cn('member-section')}>
        <div className={cn('section-head')}>
          <h2>队伍成员</h2>
          <span>{formatNumber(members.length)} 名</span>
        </div>
        <div className={cn('member-grid')}>
          {members.length ? members.map((member) => <MemberCard member={member} key={`${member.membershipType}-${member.membershipId}`} />) : (
            <div className={cn('empty-card')}>没有检测到公开队伍成员。</div>
          )}
        </div>
      </section>
    </>
  );
}

function ActivityCard({ lookup }: { lookup: FireteamLookupDto }) {
  const activity = lookup.currentActivity || {};
  const title = activity.name || (activity.rawAvailable ? '当前活动名称未公开' : '未检测到当前活动');
  return (
    <section className={cn('current-activity-card')}>
      {activity.image ? <img src={activity.image} alt="" /> : <div className={cn('activity-placeholder')}></div>}
      <div>
        <span>当前状态</span>
        <h2>{title}</h2>
        <p>{activity.startTime ? `开始 ${dateTime(activity.startTime)} · 已进行 ${formatSeconds(activity.elapsedSeconds)}` : 'Bungie 未公开当前活动开始时间'}</p>
      </div>
    </section>
  );
}

function MemberCard({ member }: { member: FireteamMemberLookupDto }) {
  const account = member.account || {};
  const profile = member.profile || {};
  const stats = member.stats || {};
  const raid = member.endgame?.raid?.total || stats.raid || {};
  const dungeon = member.endgame?.dungeon?.total || stats.dungeon || {};
  const pvp = stats.pvp || {};
  const name = account.displayName || member.membershipId || '未知成员';
  const careerUrl = `/career.html?q=${encodeURIComponent(name)}`;

  return (
    <article className={cn(`member-card ${member.error ? 'error' : ''}`)}>
      <div className={cn('member-head')}>
        <div>
          <h3>{name}</h3>
          <p>{account.membershipTypeName || 'Destiny'} · {account.membershipId || member.membershipId}</p>
        </div>
        {member.statusLabel ? <span>{member.statusLabel}</span> : null}
      </div>
      {member.error ? <Notice message={member.error} error /> : (
        <>
          <div className={cn('member-stats')}>
            <MiniStat label="最高光等" value={profile.maxLight || '-'} />
            <MiniStat label="总时长" value={formatMinutes(profile.totalMinutesPlayed)} />
            <MiniStat label="Raid 完成" value={member.endgameLoading && !raid.clears ? '加载中' : statDisplay(raid.clears || raid.activitiesCleared)} />
            <MiniStat label="地牢完成" value={member.endgameLoading && !dungeon.clears ? '加载中' : statDisplay(dungeon.clears || dungeon.activitiesCleared)} />
            <MiniStat label="PvP KD" value={statDisplay(pvp.kd)} />
            <MiniStat label="PvP 胜率" value={winRate(pvp)} />
          </div>
          <div className={cn('member-footer')}>
            <span>{profile.dateLastPlayed ? `最后在线 ${dateTime(profile.dateLastPlayed)}` : '公开资料'}</span>
            <a href={careerUrl}>查看生涯</a>
          </div>
          {member.warnings?.length ? <p className={cn('member-warning')}>{member.warnings[0]}</p> : null}
        </>
      )}
    </article>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <section className={cn('empty-state')}>
      <h2>{loading ? '正在查询队伍' : '选择一个玩家开始查询'}</h2>
      <p>当前队伍依赖 Bungie 的临时公开状态；如果玩家未在线、隐私受限或数据未同步，可能只显示被查询玩家本人。</p>
    </section>
  );
}

function playerRequest(player: PlayerSearchItemDto) {
  return {
    bungieName: player.bungieName,
    membershipType: player.membershipType,
    membershipId: player.membershipId
  };
}

function joinabilityNote(joinability: any) {
  if (!joinability) return '未知';
  if (joinability.openSlots == null) return '未知';
  return `${joinability.openSlots} 个空位`;
}

function formatSeconds(value: unknown) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${(minutes / 60).toFixed(1)} 小时`;
}

function mergeMemberEndgame(current: FireteamLookupDto | null, target: FireteamMemberLookupDto, payload: any): FireteamLookupDto | null {
  if (!current) return current;
  return {
    ...current,
    members: (current.members || []).map((member) => {
      if (memberKey(member) !== memberKey(target)) return member;
      const stats = { ...(member.stats || {}) };
      if (payload.statsPatch?.raid) stats.raid = payload.statsPatch.raid;
      if (payload.statsPatch?.dungeon) stats.dungeon = payload.statsPatch.dungeon;
      return {
        ...member,
        endgameLoading: false,
        endgame: { ...(member.endgame || {}), ...(payload.endgame || {}) },
        stats,
        cache: { ...(member.cache || {}), ...(payload.cache || {}) }
      };
    })
  };
}

function markMemberEndgameDone(current: FireteamLookupDto | null, target: FireteamMemberLookupDto, warning: string): FireteamLookupDto | null {
  if (!current) return current;
  return {
    ...current,
    members: (current.members || []).map((member) => memberKey(member) === memberKey(target)
      ? { ...member, endgameLoading: false, warnings: [warning, ...(member.warnings || [])] }
      : member)
  };
}

function memberKey(member: FireteamMemberLookupDto) {
  return `${member.account?.membershipType || member.membershipType || ''}:${member.account?.membershipId || member.membershipId || ''}`;
}

createRoot(document.getElementById('root')!).render(<FireteamPage />);
