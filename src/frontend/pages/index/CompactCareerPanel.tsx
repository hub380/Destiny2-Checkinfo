import type { ReactNode } from 'react';
import {
  StaggerList,
  formatBungieName,
  formatMinutes,
  statDisplay,
  staggerStyle
} from '@frontend/ui';
import type { CareerSummaryDto } from '@frontend/lib/types';
import { formatCacheHint } from '@frontend/lib/cache-hint';
import { COPY_HOME_SUMMARY_NOTE } from '@frontend/lib/copy';
import { isEndgameModeLoading, loadingText } from '../career/career-utils';
import { cn } from './home-cn';

export function CompactCareerPanel({ career }: { career: CareerSummaryDto }) {
  const stats = career.stats || {};
  const pvp = stats.pvp || {};
  const raid = career.endgame?.raid || stats.raid || {};
  const dungeon = career.endgame?.dungeon || stats.dungeon || {};
  const raidTotal = raid.total || raid;
  const dungeonTotal = dungeon.total || dungeon;
  const cacheHint = formatCacheHint(career.cache);
  const careerLinkQuery = formatBungieName(
    career.account?.displayName as string,
    career.account?.displayNameCode as number,
    career.queriedName || (career.account?.bungieName as string)
  );

  return (
    <div className={cn('career-result')}>
      <div className={cn('account-head')}>
        <h3>{career.account.displayName}</h3>
        <p>
          {career.account.membershipTypeName} · {career.account.membershipId}
          {cacheHint ? ` · ${cacheHint}` : ''}
        </p>
      </div>
      <div className={cn('stat-grid')}>
        {statTile('守护者等级', career.profile?.guardianRank || '-')}
        {statTile('最高光等', career.profile?.maxLight || '-')}
        {statTile('总时长', formatMinutes(career.profile?.totalMinutesPlayed))}
        {statTile('角色数', career.profile?.characterCount || 0)}
        {statTile('Raid 完成', endgameStat(raidTotal.clears, career, 'raid'), '概要')}
        {statTile('地牢完成', endgameStat(dungeonTotal.clears, career, 'dungeon'), '概要')}
        {statTile('PvP 胜场', statDisplay(pvp.activitiesWon))}
      </div>
      <div className={cn('section-title')}>角色</div>
      <StaggerList className={cn('character-list')}>
        {(career.characters || []).map((character, index) => (
          <div className={cn('character staggerItem')} key={character.id} style={staggerStyle(index)}>
            <img src={character.emblemPath || '/brand.svg'} alt="" loading="lazy" decoding="async" />
            <div>
              <b>{character.className}</b>
              <span>{[character.raceName, character.genderName].filter(Boolean).join(' · ')}</span>
            </div>
            <div className={cn('power')}>{character.light || '-'}</div>
          </div>
        ))}
      </StaggerList>
      {careerLinkQuery ? (
        <a className={cn('view-full-link')} href={`/career.html?q=${encodeURIComponent(careerLinkQuery)}`}>
          查看完整生涯（PvP · 锻造 · 详细历史）→
        </a>
      ) : null}
      <p className={cn('summary-footnote')}>{COPY_HOME_SUMMARY_NOTE}</p>
    </div>
  );
}

function endgameStat(value: unknown, career: CareerSummaryDto, mode: 'raid' | 'dungeon') {
  if (isEndgameModeLoading(career, mode)) return loadingText(true);
  return statDisplay(value as Parameters<typeof statDisplay>[0]);
}

function statTile(label: string, value: ReactNode, note?: string) {
  return (
    <div className={cn('stat-tile')}>
      <span>{note ? `${label}(${note})` : label}</span>
      <b>{value}</b>
    </div>
  );
}
