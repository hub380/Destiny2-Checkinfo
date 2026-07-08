import React, { Suspense, lazy } from 'react';
import { MetricCard, dateTime, formatBungieName, formatMinutes, statDisplay, winRate } from '@frontend/ui';
import type { EndgameMode } from '@frontend/lib/career-merge';
import type { CareerProgressStage } from '@frontend/hooks/useCareerProgressiveLoad';
import { formatCacheHint } from '@frontend/lib/cache-hint';
import type {
  CareerRecordsDto,
  CareerSummaryDto,
  CraftingSummaryDto,
  EndgameStatBlockDto
} from '@frontend/lib/types';
import { cn } from './career-cn';
import { isEndgameModeLoading, loadingText, resolveEndgameMode } from './career-utils';
import { CharactersPanel, PvpPanel, RecordPanel } from './CareerInfoPanels';

const EndgamePanel = lazy(() => import('./EndgamePanel').then((module) => ({ default: module.EndgamePanel })));
const CraftingPanel = lazy(() => import('./CraftingPanel').then((module) => ({ default: module.CraftingPanel })));

type CareerDetailProps = {
  career: CareerSummaryDto;
  ensureDetails?: () => void | Promise<void>;
  ensureEndgameModes?: (modes: EndgameMode[]) => void | Promise<void>;
  progressiveStage?: CareerProgressStage;
  autoProgressive?: boolean;
};

function PanelFallback({ label }: { label: string }) {
  return <div className={cn('detail-loading')}>{label}</div>;
}

export function CareerDetail({
  career,
  progressiveStage = 'idle',
  autoProgressive = false
}: CareerDetailProps) {
  const stats = career.stats || {};
  const profile = career.profile || {};
  const details = career.details || {};
  const records = (details.records || {}) as CareerRecordsDto;
  const crafting = (details.crafting || {}) as CraftingSummaryDto;
  const pvp = stats.pvp || {};
  const pvpHistory = (career.endgame?.pvp || {}) as EndgameStatBlockDto;
  const pvpTotal = pvpHistory.total || pvp;
  const raid = resolveEndgameMode(career, 'raid');
  const dungeon = resolveEndgameMode(career, 'dungeon');
  const raidTotal = raid.total || raid;
  const dungeonTotal = dungeon.total || dungeon;
  const cacheHint = formatCacheHint(career.cache);
  const endgameAutoStarted = progressiveStage === 'endgame' || progressiveStage === 'pvp' || progressiveStage === 'done';
  const raidLoading = isEndgameModeLoading(career, 'raid');
  const dungeonLoading = isEndgameModeLoading(career, 'dungeon');
  const raidLazyPending =
    autoProgressive &&
    !raidLoading &&
    !(raid.activities || []).length &&
    progressiveStage !== 'endgame' &&
    progressiveStage !== 'pvp' &&
    progressiveStage !== 'done';
  const dungeonLazyPending =
    autoProgressive &&
    !dungeonLoading &&
    !(dungeon.activities || []).length &&
    progressiveStage !== 'endgame' &&
    progressiveStage !== 'pvp' &&
    progressiveStage !== 'done';

  const careerLinkQuery = formatBungieName(
    career.account?.displayName as string,
    career.account?.displayNameCode as number,
    career.queriedName || (career.account?.bungieName as string)
  );
  const fireteamUrl = careerLinkQuery ? `/fireteam.html?q=${encodeURIComponent(careerLinkQuery)}` : undefined;

  return (
    <>
      <section className={cn('career-profile-panel panelReveal')}>
        <div className={cn('career-account-head')}>
          <div>
            <h2>{career.account.displayName}</h2>
            <p>{career.account.membershipTypeName} · {career.account.membershipId}</p>
          </div>
          <div className={cn('career-account-meta')}>
            <span>{career.queriedName || ''}</span>
            <span>{profile.dateLastPlayed ? `最后在线 ${dateTime(profile.dateLastPlayed)}` : '公开资料'}</span>
            {cacheHint ? <span>{cacheHint}</span> : null}
            {fireteamUrl ? <a href={fireteamUrl}>查棒鸡队伍</a> : null}
          </div>
        </div>
        <div className={cn('career-metric-grid career-summary-metrics')}>
          <MetricCard label="守护者等级" value={profile.guardianRank || '-'} note="当前等级" />
          <MetricCard label="最高光等" value={profile.maxLight || '-'} note="角色最高光" />
          <MetricCard label="总时长" value={formatMinutes(profile.totalMinutesPlayed)} note="全部角色" />
          <MetricCard label="Raid 完成" value={statDisplay(raidTotal.clears)} note={`${statDisplay(raidTotal.completionRate)} 完成率 · ${endgameAutoStarted ? '完整' : '概要'}`} />
          <MetricCard label="地牢完成" value={statDisplay(dungeonTotal.clears)} note={`${statDisplay(dungeonTotal.completionRate)} 完成率 · ${endgameAutoStarted ? '完整' : '概要'}`} />
          <MetricCard label="PvP 胜场" value={statDisplay(pvpTotal.activitiesWon)} note={`${winRate(pvpTotal)} 胜率`} />
          <MetricCard label="锻造解锁" value={crafting.unlocked ? `${statDisplay(crafting.unlocked)} / ${statDisplay(crafting.total)}` : '-'} note={statDisplay(crafting.completionRate) || loadingText(career.detailLoading)} />
        </div>
      </section>

      <section className={cn('career-section-grid panelReveal')}>
        <div className={cn('career-section-pair')}>
          <CharactersPanel characters={career.characters || []} />
          <RecordPanel records={records} loading={career.detailLoading} error={career.detailError} />
        </div>
        <PvpPanel pvp={pvp} history={pvpHistory} loading={isEndgameModeLoading(career, 'pvp')} error={career.endgameErrors?.pvp} />
      </section>

      <section className={cn('career-section-wide panelReveal')}>
        <Suspense fallback={<PanelFallback label="Raid / 地牢面板加载中" />}>
          <EndgamePanel
            label="Raid"
            mode={raid}
            loading={raidLoading}
            error={career.endgameErrors?.raid}
            lazyPending={raidLazyPending}
          />
          <EndgamePanel
            label="地牢"
            mode={dungeon}
            loading={dungeonLoading}
            error={career.endgameErrors?.dungeon}
            lazyPending={dungeonLazyPending}
          />
        </Suspense>
      </section>

      <div className={cn('panelReveal')}>
        <Suspense fallback={<PanelFallback label="锻造面板加载中" />}>
          <CraftingPanel crafting={crafting} loading={career.detailLoading} error={career.detailError} />
        </Suspense>
      </div>
    </>
  );
}
