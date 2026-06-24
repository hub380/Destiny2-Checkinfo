import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { PlayerSearchBox } from '@frontend/components/search';
import {
  AppShell,
  FadeIn,
  LoadingPulse,
  MetricCard,
  MiniStat,
  Notice,
  StaggerList,
  createPageCn,
  dateTime,
  formatMinutes,
  formatNumber,
  statDisplay,
  winRate
} from '@frontend/ui';
import { readUrlSearchParam, useMountUrlParam, usePlayerSearch } from '@frontend/hooks';
import { getEndgame, getFireteamLookup } from '@frontend/lib/api';
import type { FireteamLookupDto, FireteamMemberLookupDto, PlayerSearchItemDto } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import styles from './fireteam.module.css';

const cn = createPageCn(styles);

export function FireteamPage() {
  const [query, setQuery] = useState(() => readUrlSearchParam('q') || '');
  const [lookup, setLookup] = useState<FireteamLookupDto | null>(null);
  const [notice, setNotice] = useState('输入玩家棒鸡 ID，查询该玩家当前公开队伍。');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchItemDto | null>(null);
  const playerSearch = usePlayerSearch(query);

  const runQuery = useCallback(async (body: Record<string, unknown>) => {
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
    playerSearch.clearSuggestions();
    try {
      const payload = await getFireteamLookup({
        ...body,
        bungieName,
        modes: ['raid', 'dungeon']
      });
      setLookup(payload);
      setNotice(payload.message || '查询完成。');
      setError(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '队伍查询失败';
      setNotice(message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query, playerSearch]);

  useMountUrlParam('q', useCallback((value: string) => {
    setQuery(value);
    void runQuery({ bungieName: value });
  }, [runQuery]));

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
      const items = await playerSearch.refreshSuggestions(value);
      playerSearch.setOpen(true);
      setNotice(items.length ? '请选择一个完整的棒鸡 ID 后查询当前队伍。' : '没有匹配的棒鸡玩家。');
      setError(!items.length);
      return;
    }
    await runQuery({ bungieName: value });
  }

  async function selectPlayer(player: PlayerSearchItemDto) {
    setSelectedPlayer(player);
    setQuery(player.bungieName);
    playerSearch.clearSuggestions();
    await runQuery(playerRequest(player));
  }

  return (
    <AppShell title="Destiny 2 队伍查询" subtitle="当前队伍 · 公开生涯对比 · Raid / 地牢 / PvP" current="fireteam">
      <FadeIn className={cn('fireteam-page')}>
        <section className={cn('panel fireteam-query-panel panelEnter')}>          <div className={cn('panel-header')}>
            <div>
              <h2>队伍查询</h2>
              <p>{lookup?.updatedAt ? `更新 ${dateTime(lookup.updatedAt)}` : '输入玩家名称前缀选择棒鸡 ID，或直接输入 名称#数字代码'}</p>
            </div>
          </div>
          <PlayerSearchBox
            query={query}
            onQueryChange={updateQuery}
            search={playerSearch}
            onSubmit={onSubmit}
            onSelectPlayer={selectPlayer}
            submitting={loading}
            formClassName="career-search fireteam-search"
          />
          <Notice message={notice} error={error} />
        </section>

        {lookup ? <FireteamResult lookup={lookup} loading={loading} /> : <EmptyState loading={loading} />}
      </FadeIn>
    </AppShell>
  );}

function FireteamResult({ lookup, loading }: { lookup: FireteamLookupDto; loading: boolean }) {
  const members = lookup.members || [];
  return (
    <>
      <section className={cn('fireteam-overview panelEnter')}>
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
        <StaggerList className={cn('member-grid')}>
          {members.length ? members.map((member) => <MemberCard member={member} key={`${member.membershipType}-${member.membershipId}`} />) : (
            <div className={cn('empty-card')}>没有检测到公开队伍成员。</div>
          )}
        </StaggerList>      </section>
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
    <article className={cn(`member-card cardHover ${member.error ? 'error' : ''}`)}>      <div className={cn('member-head')}>
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
    <section className={cn('empty-state panelEnter')}>
      {loading ? (
        <LoadingPulse>
          <h2>正在查询队伍</h2>
        </LoadingPulse>
      ) : (
        <h2>选择一个玩家开始查询</h2>
      )}
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

