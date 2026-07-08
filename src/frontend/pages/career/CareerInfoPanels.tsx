import {
  MiniStat,
  ActionNotice,
  dateOnly,
  formatMinutes,
  privacyText,
  statDisplay,
  winRate
} from '@frontend/ui';
import type { CareerRecordsDto, CharacterDto, EndgameStatBlockDto, PvpSubModeDto } from '@frontend/lib/types';
import { cn } from './career-cn';

export function CharactersPanel({ characters }: { characters: CharacterDto[] }) {
  return (
    <article className={cn('career-info-card career-characters-card')}>
      <div className={cn('career-card-head')}>
        <h3>角色</h3>
        <span>{characters.length} 个</span>
      </div>
      <div className={cn('career-character-grid')}>
        {characters.length ? characters.map((character) => (
          <div className={cn('career-character')} key={character.id}>
            <img src={character.emblemPath || '/brand.svg'} alt="" loading="lazy" />
            <div className={cn('career-character-body')}>
              <div className={cn('career-character-top')}>
                <b>{character.className || '-'}</b>
                <span className={cn('career-character-light')}>{character.light || '-'}</span>
              </div>
              <span className={cn('career-character-meta')}>
                {[character.raceName, character.genderName].filter(Boolean).join(' · ') || '—'}
              </span>
              <em>{formatMinutes(character.minutesPlayedTotal)}</em>
            </div>
          </div>
        )) : <div className={cn('detail-loading')}>没有角色数据</div>}
      </div>
    </article>
  );
}

export function RecordPanel({ records, loading, error }: { records: CareerRecordsDto; loading?: boolean; error?: string }) {
  return (
    <article className={cn('career-info-card career-records-card')}>
      <div className={cn('career-card-head')}>
        <h3>成就点数</h3>
        <span>{privacyText(records.privacy)}</span>
      </div>
      <ActionNotice message={error} error />
      {loading ? <div className={cn('detail-loading')}>成就数据加载中</div> : (
        <div className={cn('career-mini-grid record-panel-grid')}>
          <MiniStat label="当前分数" value={statDisplay(records.activeScore)} />
          <MiniStat label="生涯分数" value={statDisplay(records.lifetimeScore)} />
          <MiniStat label="传承分数" value={statDisplay(records.legacyScore)} />
          <MiniStat label="完成记录" value={`${statDisplay(records.completedRecords)} / ${statDisplay(records.recordCount)}`} />
        </div>
      )}
    </article>
  );
}

export function PvpPanel({
  pvp,
  history,
  loading,
  error
}: {
  pvp: EndgameStatBlockDto;
  history: EndgameStatBlockDto;
  loading: boolean;
  error?: string;
}) {
  const total = history.total || pvp || {};
  const subModes = Array.isArray(history.subModes) ? history.subModes : [];
  return (
    <article className={cn('career-info-card pvp-history-card')}>
      <div className={cn('career-card-head')}>
        <h3>PvP 数据</h3>
        <span>{loading ? '完整历史加载中' : `${statDisplay(total.activitiesEntered)} 场`}</span>
      </div>
      <div className={cn('career-mini-grid pvp-summary-grid')}>
        <MiniStat label="场次" value={statDisplay(total.activitiesEntered)} />
        <MiniStat label="胜场" value={statDisplay(total.activitiesWon)} />
        <MiniStat label="胜率" value={winRate(total)} />
        <MiniStat label="击败" value={statDisplay(total.opponentsDefeated || total.kills)} />
        <MiniStat label="KD" value={statDisplay(total.kd)} />
        <MiniStat label="KDA" value={statDisplay(total.kda)} />
        <MiniStat label="效率" value={statDisplay(total.efficiency)} />
        <MiniStat label="时长" value={total.hours ? `${statDisplay(total.hours)} 小时` : statDisplay(total.secondsPlayed)} />
      </div>
      <ActionNotice message={error} error />
      <div className={cn('pvp-mode-list')}>
        {subModes.length ? subModes.map((mode: PvpSubModeDto) => (
          <div className={cn('pvp-mode-row')} key={mode.modeId || mode.label}>
            <div>
              <b>{mode.label || `PvP 模式 ${mode.modeId || '-'}`}</b>
              <span>{mode.lastPlayed ? `最近 ${dateOnly(mode.lastPlayed)}` : '暂无最近记录'}</span>
            </div>
            <div className={cn('pvp-mode-stats')}>
              <MiniStat label="场次" value={statDisplay(mode.activitiesEntered)} />
              <MiniStat label="胜率" value={statDisplay(mode.winRate)} />
              <MiniStat label="KD" value={statDisplay(mode.kd)} />
              <MiniStat label="击败" value={statDisplay(mode.opponentsDefeated || mode.kills)} />
            </div>
          </div>
        )) : <div className={cn('detail-loading')}>{loading ? 'PvP 完整历史加载中' : '没有公开 PvP 活动历史'}</div>}
      </div>
    </article>
  );
}
