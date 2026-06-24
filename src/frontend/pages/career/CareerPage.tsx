import React, { FormEvent, useState } from 'react';
import { PlayerSearchBox } from '@frontend/components/search';
import {
  AppShell,
  FadeIn,
  LoadingPulse,
  MetricCard,
  MiniStat,
  Notice,
  createPageCn,
  dateOnly,
  dateTime,
  formatMinutes,
  formatNumber,
  formatTime,
  privacyText,
  statDisplay,
  winRate
} from '@frontend/ui';
import { useCareerQuery, readUrlSearchParam, useMountUrlParam, usePlayerSearch } from '@frontend/hooks';
import type { CareerSummaryDto, CharacterDto, PlayerSearchItemDto } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import styles from './career.module.css';
import craftingStyles from './crafting.module.css';

const cn = createPageCn(styles, [craftingStyles]);

export function CareerPage() {
  const [query, setQuery] = useState(() => readUrlSearchParam('q') || '');
  const playerSearch = usePlayerSearch(query);
  const { career, loading, error, query: runCareerQuery } = useCareerQuery({
    modes: ['raid', 'dungeon', 'pvp'],
    includeDetails: true
  });

  useMountUrlParam('q', (value) => {
    setQuery(value);
    void runCareerQuery(value);
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value && !value.includes('#')) {
      const items = await playerSearch.refreshSuggestions(value);
      playerSearch.setOpen(true);
      if (!items.length) return;
      return;
    }
    playerSearch.clearSuggestions();
    await runCareerQuery(value);
  }

  async function selectPlayer(player: PlayerSearchItemDto) {
    if (!player.bungieName) return;
    setQuery(player.bungieName);
    playerSearch.clearSuggestions();
    await runCareerQuery(player.bungieName);
  }

  const submitHint = query.trim() && !query.includes('#')
    ? (playerSearch.suggestions.length ? '请选择一个完整的棒鸡 ID 后查询' : playerSearch.notice || '没有匹配的棒鸡玩家')
    : '';
  const notice = error || submitHint;
  const noticeError = Boolean(error) || Boolean(submitHint && !playerSearch.suggestions.length);

  return (
    <AppShell title="Destiny 2 玩家生涯" subtitle="公开生涯 · Raid / 地牢 · PvP · 锻造进度" current="career">
      <FadeIn className={cn('career-page')}>
        <section className={cn('panel career-query-panel panelEnter')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>玩家查询</h2>
              <p>{career?.updatedAt ? `更新 ${formatTime(career.updatedAt)}` : '输入棒鸡 ID 查询公开玩家生涯'}</p>
            </div>
          </div>
          <PlayerSearchBox
            query={query}
            onQueryChange={setQuery}
            search={playerSearch}
            onSubmit={onSubmit}
            onSelectPlayer={selectPlayer}
            submitting={loading}
            wide
            formClassName="career-search career-page-search"
          />
          <Notice message={notice} error={noticeError} />
        </section>
        <section className={cn('career-detail-root')}>
          {career ? (
            <FadeIn variant="detail" className={cn('contentSwap')}>
              <CareerDetail career={career} />
            </FadeIn>
          ) : loading ? (
            <LoadingPulse className={cn('career-result empty loading')}>
              正在查询玩家生涯
            </LoadingPulse>
          ) : (
            <div className={cn('career-result empty')}>暂无查询结果</div>
          )}
        </section>
      </FadeIn>
    </AppShell>
  );
}

function CareerDetail({ career }: { career: CareerSummaryDto }) {
  const stats = career.stats || {};
  const profile = career.profile || {};
  const details = career.details || {};
  const records = details.records || {};
  const crafting = details.crafting || {};
  const pvp = stats.pvp || {};
  const pvpHistory = career.endgame?.pvp || {};
  const pvpTotal = pvpHistory.total || pvp;
  const raid = career.endgame?.raid || stats.raid || {};
  const dungeon = career.endgame?.dungeon || stats.dungeon || {};
  const raidTotal = raid.total || raid;
  const dungeonTotal = dungeon.total || dungeon;

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

function CharactersPanel({ characters }: { characters: CharacterDto[] }) {
  return (
    <article className={cn('career-info-card')}>
      <div className={cn('career-card-head')}>
        <h3>角色</h3>
        <span>{characters.length} 个</span>
      </div>
      <div className={cn('career-character-grid')}>
        {characters.length ? characters.map((character) => (
          <div className={cn('career-character')} key={character.id}>
            <img src={character.emblemPath || '/brand.svg'} alt="" />
            <div>
              <b>{character.className || '-'}</b>
              <span>{[character.raceName, character.genderName].filter(Boolean).join(' · ')}</span>
              <em>{formatMinutes(character.minutesPlayedTotal)}</em>
            </div>
            <strong>{character.light || '-'}</strong>
          </div>
        )) : <div className={cn('detail-loading')}>没有角色数据</div>}
      </div>
    </article>
  );
}

function RecordPanel({ records, loading, error }: { records: any; loading?: boolean; error?: string }) {
  return (
    <article className={cn('career-info-card')}>
      <div className={cn('career-card-head')}>
        <h3>成就点数</h3>
        <span>{privacyText(records.privacy)}</span>
      </div>
      <Notice message={error} error />
      {loading ? <div className={cn('detail-loading')}>成就数据加载中</div> : (
        <div className={cn('career-mini-grid')}>
          <MiniStat label="当前分数" value={statDisplay(records.activeScore)} />
          <MiniStat label="生涯分数" value={statDisplay(records.lifetimeScore)} />
          <MiniStat label="传承分数" value={statDisplay(records.legacyScore)} />
          <MiniStat label="完成记录" value={`${statDisplay(records.completedRecords)} / ${statDisplay(records.recordCount)}`} />
        </div>
      )}
    </article>
  );
}

function PvpPanel({ pvp, history, loading, error }: { pvp: any; history: any; loading: boolean; error?: string }) {
  const total = history.total || pvp || {};
  const subModes = Array.isArray(history.subModes) ? history.subModes : [];
  return (
    <article className={cn('career-info-card pvp-history-card')}>
      <div className={cn('career-card-head')}>
        <h3>PvP 数据</h3>
        <span>{loading ? '完整历史加载中' : `${statDisplay(total.activitiesEntered)} 场`}</span>
      </div>
      <div className={cn('career-mini-grid')}>
        <MiniStat label="场次" value={statDisplay(total.activitiesEntered)} />
        <MiniStat label="胜场" value={statDisplay(total.activitiesWon)} />
        <MiniStat label="胜率" value={winRate(total)} />
        <MiniStat label="击败" value={statDisplay(total.opponentsDefeated || total.kills)} />
        <MiniStat label="KD" value={statDisplay(total.kd)} />
        <MiniStat label="KDA" value={statDisplay(total.kda)} />
        <MiniStat label="效率" value={statDisplay(total.efficiency)} />
        <MiniStat label="时长" value={total.hours ? `${statDisplay(total.hours)} 小时` : statDisplay(total.secondsPlayed)} />
      </div>
      <Notice message={error} error />
      <div className={cn('pvp-mode-list')}>
        {subModes.length ? subModes.map((mode: any) => (
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

function EndgamePanel({ label, mode, loading, error }: { label: string; mode: any; loading: boolean; error?: string }) {
  const total = mode.total || mode || {};
  const activities = Array.isArray(mode.activities) ? mode.activities : [];
  return (
    <article className={cn('career-endgame-card')}>
      <div className={cn('career-card-head')}>
        <h3>{label}</h3>
        <span>{loading ? '完整历史加载中' : `${statDisplay(total.clears)} 完成`}</span>
      </div>
      <div className={cn('career-mini-grid endgame-summary')}>
        <MiniStat label="完成" value={statDisplay(total.clears)} />
        <MiniStat label="进入" value={statDisplay(total.activitiesEntered || total.attempts)} />
        <MiniStat label="完成率" value={statDisplay(total.completionRate)} />
        <MiniStat label="击杀" value={statDisplay(total.kills)} />
        <MiniStat label="死亡" value={statDisplay(total.deaths)} />
        <MiniStat label="KD" value={statDisplay(total.kd)} />
        <MiniStat label="时长" value={total.hours ? `${statDisplay(total.hours)} 小时` : '-'} />
        <MiniStat label="Solo 无暇" value={statDisplay(total.soloFlawlessClears)} />
      </div>
      <Notice message={error} error />
      <div className={cn('career-activity-grid')}>
        {activities.length ? activities.map((activity: any) => <EndgameActivity activity={activity} key={`${label}-${activity.name}`} />) : (
          <div className={cn('detail-loading')}>{loading ? '活动历史加载中' : '没有公开活动历史'}</div>
        )}
      </div>
    </article>
  );
}

function EndgameActivity({ activity }: { activity: any }) {
  const variants = Array.isArray(activity.variants) ? activity.variants : [];
  return (
    <div className={cn('career-activity-card')}>
      <img src={activity.image || '/brand.svg'} alt="" />
      <div className={cn('activity-detail-main')}>
        <div>
          <b>{activity.name || '未知活动'}</b>
          <span>{activity.variantCount > 1 ? `${activity.variantCount} 个变体` : '单一变体'}</span>
        </div>
        <EndgameTags item={activity} />
      </div>
      <div className={cn('career-activity-stats')}>
        <MiniStat label="完成/进入" value={`${statDisplay(activity.clears)} / ${statDisplay(activity.attempts)}`} />
        <MiniStat label="完成率" value={statDisplay(activity.completionRate)} />
        <MiniStat label="KD" value={statDisplay(activity.kd)} />
        <MiniStat label="击杀" value={statDisplay(activity.kills)} />
        <MiniStat label="最佳" value={statDisplay(activity.bestTime)} />
        <MiniStat label="最近" value={activity.lastPlayed ? dateOnly(activity.lastPlayed) : '-'} />
      </div>
      {variants.length > 1 ? (
        <div className={cn('career-variant-list')}>
          {variants.slice(0, 8).map((variant: any) => (
            <div className={cn('career-variant-row')} key={variant.hash || variant.name}>
              <span>{variant.name || '未知变体'}</span>
              <b>{statDisplay(variant.clears)} 完成</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EndgameTags({ item }: { item: any }) {
  const tags = [];
  const solo = Number(item.soloClears?.value || 0);
  const soloFlawless = Number(item.soloFlawlessClears?.value || 0);
  if (solo > 0) tags.push(`Solo x${solo}`);
  if (soloFlawless > 0) tags.push(`Solo 无暇 x${soloFlawless}`);
  if (!tags.length) return null;
  return <div className={cn('activity-tags')}>{tags.map((tag) => <em key={tag}>{tag}</em>)}</div>;
}

function CraftingPanel({ crafting, loading, error }: { crafting: any; loading?: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(crafting.items) ? crafting.items : [];
  const groups = buildCraftingGroups(items);
  return (
    <section className={cn('career-crafting-panel')}>
      <div className={cn('career-card-head')}>
        <h3>锻造进度</h3>
        <span>{privacyText(crafting.privacy)}</span>
      </div>
      <Notice message={error} error />
      {loading ? <div className={cn('detail-loading')}>锻造数据加载中</div> : (
        <>
          <div className={cn('career-mini-grid crafting-summary')}>
            <MiniStat label="配方解锁" value={`${statDisplay(crafting.unlocked)} / ${statDisplay(crafting.total)}`} />
            <MiniStat label="配方完成率" value={statDisplay(crafting.completionRate)} />
            <MiniStat label="Perk 解锁" value={`${statDisplay(crafting.plugUnlocked)} / ${statDisplay(crafting.plugTotal)}`} />
            <MiniStat label="Perk 完成率" value={statDisplay(crafting.plugCompletionRate)} />
          </div>
          <div className={cn('crafting-summary-actions')}>
            <div>
              <b>{formatNumber(groups.length)} 个来源</b>
              <span>{formatNumber(items.length)} 件可锻造装备</span>
            </div>
            <button className={cn('button secondary')} type="button" onClick={() => setOpen(true)}>查看明细</button>
          </div>
          {open ? <CraftingModal crafting={crafting} groups={groups} onClose={() => setOpen(false)} /> : null}
        </>
      )}
    </section>
  );
}

function CraftingModal({ crafting, groups, onClose }: { crafting: any; groups: any[]; onClose: () => void }) {
  return (
    <div className={cn('career-modal')}>
      <div className={cn('career-modal-backdrop')} onClick={onClose}></div>
      <div className={cn('career-modal-panel')} role="dialog" aria-modal="true" aria-labelledby="craftingModalTitle">
        <div className={cn('career-modal-head')}>
          <div>
            <h3 id="craftingModalTitle">锻造进度</h3>
            <span>{privacyText(crafting.privacy)}</span>
          </div>
          <button className={cn('icon-button')} type="button" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className={cn('career-mini-grid crafting-summary')}>
          <MiniStat label="配方解锁" value={`${statDisplay(crafting.unlocked)} / ${statDisplay(crafting.total)}`} />
          <MiniStat label="配方完成率" value={statDisplay(crafting.completionRate)} />
          <MiniStat label="Perk 解锁" value={`${statDisplay(crafting.plugUnlocked)} / ${statDisplay(crafting.plugTotal)}`} />
          <MiniStat label="Perk 完成率" value={statDisplay(crafting.plugCompletionRate)} />
        </div>
        <div className={cn('career-modal-scroll')}>
          <div className={cn('crafting-collection-board')}>
            {groups.length ? groups.map((group) => <CraftingSourceGroup group={group} key={group.key} />) : <div className={cn('detail-loading')}>没有公开锻造数据</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CraftingSourceGroup({ group }: { group: any }) {
  return (
    <article className={cn(`crafting-source-group ${group.complete >= group.total && group.total ? 'complete' : ''}`)}>
      <div className={cn('crafting-source-head')}>
        <strong>{group.source}</strong>
        <span>收集进度：{formatNumber(group.complete)}/{formatNumber(group.total)}</span>
      </div>
      <div className={cn('crafting-source-items')}>
        {group.items.map((item: any) => <CraftingBoardItem item={item} key={item.hash} />)}
      </div>
    </article>
  );
}

function CraftingBoardItem({ item }: { item: any }) {
  const percent = craftingPatternPercent(item);
  const complete = isCraftingPatternComplete(item);
  return (
    <div className={cn(`crafting-board-item ${complete ? 'complete' : 'incomplete'}`)}>
      <div className={cn('crafting-board-icon')}>
        <img src={item.icon || '/brand.svg'} alt="" />
      </div>
      <i className={cn('crafting-pattern-meter')} style={{ '--pattern-fill': `${Math.max(0, Math.min(100, percent))}%` } as React.CSSProperties}></i>
      <div className={cn('crafting-board-copy')}>
        <b>{item.name || `装备 ${item.hash}`}</b>
        <span>{item.type || '-'}</span>
        <em>{craftingPatternLabel(item)}</em>
      </div>
    </div>
  );
}

function buildCraftingGroups(items: any[]) {
  const groups = new Map<string, any>();
  for (const item of items) {
    const source = craftingSourceLabel(item.source);
    const key = `${item.sourceHash || source}`;
    if (!groups.has(key)) groups.set(key, { key, source, items: [], complete: 0 });
    const group = groups.get(key);
    group.items.push(item);
    if (isCraftingPatternComplete(item)) group.complete += 1;
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    total: group.items.length,
    items: group.items.sort((a: any, b: any) => Number(isCraftingPatternComplete(a)) - Number(isCraftingPatternComplete(b)) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
  })).sort((a, b) => {
    const aDone = a.total ? a.complete / a.total : 0;
    const bDone = b.total ? b.complete / b.total : 0;
    return aDone - bDone || a.source.localeCompare(b.source, 'zh-CN');
  });
}

function isEndgameModeLoading(career: CareerSummaryDto, mode: string) {
  if (!career.endgameLoading) return false;
  if (career.endgameLoading === true) return !career.endgame?.[mode];
  return Boolean(career.endgameLoading[mode]);
}

function loadingText(loading?: boolean) {
  return loading ? '加载中' : '-';
}

function craftingSourceLabel(value: unknown) {
  const source = String(value || '').replace(/^来源[:：]\s*/i, '').trim();
  return source || '其他来源';
}

function craftingPatternLabel(item: any) {
  if (item.pattern?.label && item.pattern.label !== '-') return item.pattern.label;
  if (item.unlocked) return '1/1';
  return '-';
}

function craftingPatternPercent(item: any) {
  const percent = Number(item.pattern?.percent);
  if (Number.isFinite(percent)) return percent;
  return item.unlocked ? 100 : 0;
}

function isCraftingPatternComplete(item: any) {
  if (typeof item.pattern?.complete === 'boolean') return item.pattern.complete;
  return Boolean(item.unlocked);
}

