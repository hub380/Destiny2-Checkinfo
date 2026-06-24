import { MetricCard, dateTime, formatBungieName, formatMinutes, statDisplay, winRate } from '@frontend/ui';
import type {
  CareerRecordsDto,
  CareerSummaryDto,
  CraftingSummaryDto,
  EndgameStatBlockDto
} from '@frontend/lib/types';
import { cn } from './career-cn';
import { isEndgameModeLoading, loadingText } from './career-utils';
import { CharactersPanel, PvpPanel, RecordPanel } from './CareerInfoPanels';
import { EndgamePanel } from './CareerEndgamePanels';
import { CraftingPanel } from './CareerCraftingPanels';

export function CareerDetail({ career }: { career: CareerSummaryDto }) {
  const stats = career.stats || {};
  const profile = career.profile || {};
  const details = career.details || {};
  const records = (details.records || {}) as CareerRecordsDto;
  const crafting = (details.crafting || {}) as CraftingSummaryDto;
  const pvp = stats.pvp || {};
  const pvpHistory = (career.endgame?.pvp || {}) as EndgameStatBlockDto;
  const pvpTotal = pvpHistory.total || pvp;
  const raid = (career.endgame?.raid || stats.raid || {}) as EndgameStatBlockDto;
  const dungeon = (career.endgame?.dungeon || stats.dungeon || {}) as EndgameStatBlockDto;
  const raidTotal = raid.total || raid;
  const dungeonTotal = dungeon.total || dungeon;

  const careerLinkQuery = formatBungieName(
    career.account?.displayName as string,
    career.account?.displayNameCode as number,
    career.queriedName || (career.account?.bungieName as string)
  );
  const fireteamUrl = careerLinkQuery ? `/fireteam.html?q=${encodeURIComponent(careerLinkQuery)}` : undefined;

  return (
    <>
      <section className={cn('career-profile-panel')}>
        <div className={cn('career-account-head')}>
          <div>
            <h2>{career.account.displayName}</h2>
            <p>{career.account.membershipTypeName} · {career.account.membershipId}</p>
          </div>
          <div className={cn('career-account-meta')}>
            <span>{career.queriedName || ''}</span>
            <span>{profile.dateLastPlayed ? `最后在线 ${dateTime(profile.dateLastPlayed)}` : '公开资料'}</span>
            {fireteamUrl ? <a href={fireteamUrl}>查棒鸡队伍</a> : null}
          </div>
        </div>
        <div className={cn('career-metric-grid')}>
          <MetricCard label="守护者等级" value={profile.guardianRank || '-'} note="当前等级" />
          <MetricCard label="最高光等" value={profile.maxLight || '-'} note="角色最高光" />
          <MetricCard label="总时长" value={formatMinutes(profile.totalMinutesPlayed)} note="全部角色" />
          <MetricCard label="成就点数" value={statDisplay(records.activeScore)} note={records.lifetimeScore ? `生涯 ${statDisplay(records.lifetimeScore)}` : loadingText(career.detailLoading)} />
          <MetricCard label="Raid 完成" value={statDisplay(raidTotal.clears)} note={`${statDisplay(raidTotal.completionRate)} 完成率`} />
          <MetricCard label="地牢完成" value={statDisplay(dungeonTotal.clears)} note={`${statDisplay(dungeonTotal.completionRate)} 完成率`} />
          <MetricCard label="PvP 胜场" value={statDisplay(pvpTotal.activitiesWon)} note={`${winRate(pvpTotal)} 胜率`} />
          <MetricCard label="锻造解锁" value={crafting.unlocked ? `${statDisplay(crafting.unlocked)} / ${statDisplay(crafting.total)}` : '-'} note={statDisplay(crafting.completionRate) || loadingText(career.detailLoading)} />
        </div>
      </section>

      <section className={cn('career-section-grid')}>
        <CharactersPanel characters={career.characters || []} />
        <RecordPanel records={records} loading={career.detailLoading} error={career.detailError} />
        <PvpPanel pvp={pvp} history={pvpHistory} loading={isEndgameModeLoading(career, 'pvp')} error={career.endgameErrors?.pvp} />
      </section>

      <section className={cn('career-section-wide')}>
        <EndgamePanel label="Raid" mode={raid} loading={isEndgameModeLoading(career, 'raid')} error={career.endgameErrors?.raid} />
        <EndgamePanel label="地牢" mode={dungeon} loading={isEndgameModeLoading(career, 'dungeon')} error={career.endgameErrors?.dungeon} />
      </section>

      <CraftingPanel crafting={crafting} loading={career.detailLoading} error={career.detailError} />
    </>
  );
}
