import React from 'react';
import { PlayerSearchBox } from '@frontend/components/search';
import {
  AppShell,
  FadeIn,
  formatBungieName,
  formatSeconds,
  MetricCard,
  MiniStat,
  Notice,
  PageLoading,
  StaggerList,
  createPageCn,
  dateTime,
  formatMinutes,
  formatNumber,
  statDisplay,
  winRate
} from '@frontend/ui';
import { useBungieFireteamLookup } from '@frontend/hooks';
import type { FireteamLookupDto, FireteamMemberLookupDto } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import styles from './fireteam.module.css';

const cn = createPageCn(styles);

export function FireteamPage() {
  const {
    query,
    lookup,
    notice,
    error,
    loading,
    playerSearch,
    updateQuery,
    onSubmit,
    selectPlayer
  } = useBungieFireteamLookup();

  return (
    <AppShell title="Destiny 2 棒鸡队伍" subtitle="Bungie 当前队伍 · 成员生涯对比 · Raid / 地牢 / PvP" current="fireteam">
      <FadeIn variant="page" className={cn('fireteam-page')}>
        <section className={cn('panel fireteam-query-panel panelEnter')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>棒鸡队伍</h2>
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
  );
}

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
  const careerQuery = formatBungieName(
    account.displayName as string,
    account.displayNameCode as number | string,
    account.bungieName as string
  );
  const careerUrl = careerQuery ? `/career.html?q=${encodeURIComponent(careerQuery)}` : undefined;

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
            {careerUrl ? <a href={careerUrl}>查看生涯</a> : <span>无法生成生涯链接</span>}
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
        <PageLoading>
          <h2>正在查询队伍</h2>
        </PageLoading>
      ) : (
        <h2>选择一个玩家开始查询</h2>
      )}
      <p>当前队伍依赖 Bungie 的临时公开状态；如果玩家未在线、隐私受限或数据未同步，可能只显示被查询玩家本人。</p>
    </section>
  );
}

function joinabilityNote(joinability: Record<string, unknown> | undefined | null) {
  if (!joinability) return '未知';
  if (joinability.openSlots == null) return '未知';
  return `${joinability.openSlots} 个空位`;
}

