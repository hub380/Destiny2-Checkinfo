import React, { useMemo, useState } from 'react';
import { BungieQueryPanel } from '@frontend/components/search';
import {
  AppShell,
  ActionNotice,
  FadeIn,
  SkeletonCardGrid,
  SystemBanner,
  formatBungieName,
  formatSeconds,
  MetricCard,
  MiniStat,
  PageEmpty,
  PageLoading,
  StaggerList,
  createPageCn,
  dateTime,
  formatMinutes,
  formatNumber,
  statDisplay,
  winRate
} from '@frontend/ui';
import { useBungieFireteamLookup, usePublicConfig, useRecentQueries } from '@frontend/hooks';
import {
  COPY_FIRETEAM_EMPTY_HINT,
  COPY_FIRETEAM_EMPTY_TITLE,
  COPY_FIRETEAM_IDLE_SUBTITLE,
  COPY_FIRETEAM_LOAD_DETAILED,
  COPY_FIRETEAM_LOADING,
  COPY_FIRETEAM_SUMMARY_STATS
} from '@frontend/lib/copy';
import type { FireteamLookupDto, FireteamMemberLookupDto } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import { FireteamProgressStrip } from './FireteamProgressStrip';
import styles from './fireteam.module.css';

const cn = createPageCn(styles);

type MemberSort = 'default' | 'light' | 'raid' | 'dungeon';

const EMPTY_MEMBERS: FireteamMemberLookupDto[] = [];

export function FireteamPage() {
  const { config, ready } = usePublicConfig();
  const { recent, refresh } = useRecentQueries('fireteam');
  const {
    query,
    lookup,
    notice,
    error,
    loading,
    detailedLoading,
    endgameProgress,
    endgameDone,
    progressiveScheduled,
    playerSearch,
    updateQuery,
    onSubmit,
    selectPlayer,
    loadDetailedEndgame,
    retry
  } = useBungieFireteamLookup();

  const progressActive = detailedLoading || progressiveScheduled;

  return (
    <AppShell title="Destiny 2 棒鸡队伍" subtitle="Bungie 当前队伍 · 成员生涯对比 · Raid / 地牢" current="fireteam">
      <FadeIn variant="page" className={cn('fireteam-page')}>
        <SystemBanner hasBungieApiKey={config?.hasBungieApiKey} configReady={ready} />
        <section className={cn('panel fireteam-query-panel panelEnter')}>
          <BungieQueryPanel
            title="棒鸡队伍"
            subtitle={lookup?.updatedAt ? `更新 ${dateTime(lookup.updatedAt)}` : COPY_FIRETEAM_IDLE_SUBTITLE}
            query={query}
            onQueryChange={updateQuery}
            playerSearch={playerSearch}
            onSubmit={onSubmit}
            onSelectPlayer={selectPlayer}
            submitting={loading}
            recent={recent}
            onPickRecent={(value) => {
              updateQuery(value);
              void selectPlayer({ bungieName: value });
              refresh();
            }}
            noticeMessage={notice}
            noticeError={error}
            onRetry={retry}
            formClassName="career-search fireteam-search"
          />
          {lookup ? (
            <FireteamProgressStrip
              active={progressActive}
              loaded={endgameProgress.loaded}
              total={endgameProgress.total}
              done={endgameDone}
            />
          ) : null}
        </section>

        {lookup ? (
          <FireteamResult
            lookup={lookup}
            loading={loading}
            detailedLoading={detailedLoading}
            onLoadDetailed={() => void loadDetailedEndgame()}
          />
        ) : loading ? (
          <SkeletonCardGrid count={3} />
        ) : (
          <EmptyState loading={loading} />
        )}
      </FadeIn>
    </AppShell>
  );
}

function FireteamResult({
  lookup,
  loading,
  detailedLoading,
  onLoadDetailed
}: {
  lookup: FireteamLookupDto;
  loading: boolean;
  detailedLoading: boolean;
  onLoadDetailed: () => void;
}) {
  const [sort, setSort] = useState<MemberSort>('default');
  const members = lookup.members || EMPTY_MEMBERS;
  const sortedMembers = useMemo(() => sortMembers(members, sort), [members, sort]);
  const highlights = useMemo(() => memberHighlights(members), [members]);

  return (
    <>
      <section className={cn('fireteam-overview panelEnter')}>
        <ActivityCard lookup={lookup} />
        <div className={cn('fireteam-metrics')}>
          <MetricCard label="检测成员" value={formatNumber(lookup.summary?.displayedMembers || members.length)} note={`Bungie 返回 ${formatNumber(lookup.summary?.detectedMembers || 0)} 名`} />
          <MetricCard label="资料读取" value={formatNumber(lookup.summary?.resolvedMembers || 0)} note={loading ? '加载中' : '公开资料'} />
          <MetricCard label="加入状态" value={lookup.joinability?.label || '未知'} note={joinabilityNote(lookup.joinability)} />
          <MetricCard label="数据时效" value="实时" note={COPY_FIRETEAM_SUMMARY_STATS} />
        </div>
      </section>

      <section className={cn('member-section')}>
        <div className={cn('section-head')}>
          <h2>队伍成员</h2>
          <div className={cn('member-toolbar')}>
            <label className={cn('member-sort')}>
              <span>排序</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as MemberSort)} aria-label="成员排序">
                <option value="default">默认顺序</option>
                <option value="light">最高光等</option>
                <option value="raid">Raid 完成</option>
                <option value="dungeon">地牢完成</option>
              </select>
            </label>
            <button type="button" className={cn('load-detailed-button')} onClick={onLoadDetailed} disabled={detailedLoading}>
              {detailedLoading ? '加载详细数据中…' : COPY_FIRETEAM_LOAD_DETAILED}
            </button>
            <span className={cn('member-count')}>{formatNumber(members.length)} 名</span>
          </div>
        </div>
        <StaggerList className={cn('member-grid')} stagger={sortedMembers.length <= 20}>
          {sortedMembers.length ? sortedMembers.map((member) => (
            <MemberCard
              member={member}
              key={`${member.membershipType}-${member.membershipId}`}
              highlights={highlights}
            />
          )) : (
            <PageEmpty>没有检测到公开队伍成员</PageEmpty>
          )}
        </StaggerList>
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

function MemberCard({
  member,
  highlights
}: {
  member: FireteamMemberLookupDto;
  highlights: ReturnType<typeof memberHighlights>;
}) {
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
  const light = Number(profile.maxLight || 0);
  const raidClears = statValue(raid.clears || raid.activitiesCleared);
  const dungeonClears = statValue(dungeon.clears || dungeon.activitiesCleared);
  const summaryOnly = !member.endgameDetailed;

  return (
    <article className={cn(`member-card cardHover ${member.error ? 'error' : ''}`)}>
      <div className={cn('member-head')}>
        <div>
          <h3>{name}</h3>
          <p>{account.membershipTypeName || 'Destiny'} · {account.membershipId || member.membershipId}</p>
        </div>
        {member.statusLabel ? <span>{member.statusLabel}</span> : null}
      </div>
      {member.error ? <ActionNotice message={member.error} error /> : (
        <>
          <div className={cn('member-stats')}>
            <MiniStat label="最高光等" value={profile.maxLight || '-'} className={light === highlights.maxLight && highlights.maxLight > 0 ? cn('stat-highlight') : undefined} />
            <MiniStat label="总时长" value={formatMinutes(profile.totalMinutesPlayed)} />
            <MiniStat
              label={summaryOnly ? 'Raid 完成(概要)' : 'Raid 完成'}
              value={member.endgameLoading && !raid.clears ? '加载中' : statDisplay(raid.clears || raid.activitiesCleared)}
              className={raidClears === highlights.maxRaid && highlights.maxRaid > 0 ? cn('stat-highlight') : undefined}
            />
            <MiniStat
              label={summaryOnly ? '地牢完成(概要)' : '地牢完成'}
              value={member.endgameLoading && !dungeon.clears ? '加载中' : statDisplay(dungeon.clears || dungeon.activitiesCleared)}
              className={dungeonClears === highlights.maxDungeon && highlights.maxDungeon > 0 ? cn('stat-highlight') : undefined}
            />
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
  if (loading) {
    return (
      <PageLoading className={cn('fireteam-idle panelEnter')}>
        {COPY_FIRETEAM_LOADING}
      </PageLoading>
    );
  }
  return (
    <PageEmpty className={cn('fireteam-idle panelEnter')}>
      <b className={cn('fireteam-idle-title')}>{COPY_FIRETEAM_EMPTY_TITLE}</b>
      <p className={cn('fireteam-idle-hint')}>{COPY_FIRETEAM_EMPTY_HINT}</p>
    </PageEmpty>
  );
}

function joinabilityNote(joinability: Record<string, unknown> | undefined | null) {
  if (!joinability) return '未知';
  if (joinability.openSlots == null) return '未知';
  return `${joinability.openSlots} 个空位`;
}

function statValue(value: unknown) {
  const number = Number((value as { value?: unknown })?.value ?? value);
  return Number.isFinite(number) ? number : 0;
}

function sortMembers(members: FireteamMemberLookupDto[], sort: MemberSort) {
  const copy = [...members];
  if (sort === 'light') {
    return copy.sort((a, b) => Number(b.profile?.maxLight || 0) - Number(a.profile?.maxLight || 0));
  }
  if (sort === 'raid') {
    return copy.sort((a, b) => raidClears(b) - raidClears(a));
  }
  if (sort === 'dungeon') {
    return copy.sort((a, b) => dungeonClears(b) - dungeonClears(a));
  }
  return copy;
}

function raidClears(member: FireteamMemberLookupDto) {
  const raid = member.endgame?.raid?.total || member.stats?.raid || {};
  return statValue((raid as { clears?: unknown }).clears || (raid as { activitiesCleared?: unknown }).activitiesCleared);
}

function dungeonClears(member: FireteamMemberLookupDto) {
  const dungeon = member.endgame?.dungeon?.total || member.stats?.dungeon || {};
  return statValue((dungeon as { clears?: unknown }).clears || (dungeon as { activitiesCleared?: unknown }).activitiesCleared);
}

function memberHighlights(members: FireteamMemberLookupDto[]) {
  let maxLight = 0;
  let maxRaid = 0;
  let maxDungeon = 0;
  for (const member of members) {
    maxLight = Math.max(maxLight, Number(member.profile?.maxLight || 0));
    maxRaid = Math.max(maxRaid, raidClears(member));
    maxDungeon = Math.max(maxDungeon, dungeonClears(member));
  }
  return { maxLight, maxRaid, maxDungeon };
}
