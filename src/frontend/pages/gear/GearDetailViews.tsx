import React from 'react';
import { formatNumber } from '@frontend/ui';
import { getPerkWeapons } from '@frontend/lib/api';
import type { GearCatalyst, GearPerkEffectDetails, GearRollRecommendation, JsonRecord } from '@frontend/lib/types';
import { cn } from './gear-cn';
import {
  enhancedLines,
  perkTypeLabel,
  sourceKindLabel
} from './gear-labels';

const PERK_WEAPON_PAGE_SIZE = 24;

function gearTagKey(value: unknown, index: number) {
  return `${index}-${String(value)}`;
}

function weaponGroupKey(group: JsonRecord) {
  return [group.name, group.weaponType, group.ammo, group.element]
    .map((value) => String(value || ''))
    .join('|');
}

export function GearDetailSlot({
  detail,
  onPerkClick
}: {
  detail: JsonRecord | null;
  onPerkClick?: (perk: JsonRecord) => void;
}) {
  if (!detail) return null;
  if (detail.loading) return <div className={cn('detail-loading')}>{detail.message}</div>;
  if (detail.error) return <div className={cn('notice error')}>{detail.error}</div>;
  if (detail.weapons || detail.perks) return <PerkWeapons payload={detail} onPerkClick={onPerkClick} />;
  return <GearDetail item={detail.item} detail={detail.detail} onPerkClick={onPerkClick} />;
}

function GearDetail({
  item,
  detail,
  onPerkClick
}: {
  item: JsonRecord;
  detail: JsonRecord;
  onPerkClick?: (perk: JsonRecord) => void;
}) {
  if (!item || !detail) return <div className={cn('detail-loading')}>没有可展示的详情</div>;
  if (item.kind === 'weapon') return <WeaponDetail item={item} detail={detail} onPerkClick={onPerkClick} />;
  if (item.kind === 'armor') return <ArmorDetail item={item} detail={detail} onPerkClick={onPerkClick} />;
  return <div className={cn('detail-loading')}>点击 Perk 可反查支持该 Perk 的武器</div>;
}

function WeaponDetail({
  item,
  detail,
  onPerkClick
}: {
  item: JsonRecord;
  detail: JsonRecord;
  onPerkClick?: (perk: JsonRecord) => void;
}) {
  const recommendations = Array.isArray(detail.recommendations)
    ? detail.recommendations as GearRollRecommendation[]
    : [];
  return (
    <section className={cn('gear-detail-panel')}>
      <div className={cn('gear-detail-head')}>
        <img className={cn('gear-icon large')} src={item.icon || detail.icon || '/brand.svg'} alt="" />
        <div>
          <h3>{item.name || detail.name || '未知武器'}</h3>
          <div className={cn('gear-tags')}>
            {[detail.weaponType, detail.ammo, detail.element, detail.adept ? '专家' : ''].filter(Boolean).map((value, index) => <span className={cn('gear-tag')} key={gearTagKey(value, index)}>{value}</span>)}
          </div>
          {item.description ? <p className={cn('gear-description')}>{item.description}</p> : null}
        </div>
      </div>
      <SourceHints hints={detail.sourceHints || item.sourceHints || []} />
      <Stats stats={detail.stats || []} />
      <PerkColumns sockets={detail.sockets || []} recommendations={recommendations} onPerkClick={onPerkClick} />
      {detail.catalyst ? <CatalystSection catalyst={detail.catalyst as GearCatalyst} /> : null}
    </section>
  );
}

function SourceHints({ hints }: { hints: JsonRecord[] }) {
  const items = Array.isArray(hints) ? hints.filter((hint) => hint?.text).slice(0, 8) : [];
  if (!items.length) return null;
  return (
    <div className={cn('source-hints')}>
      <div className={cn('section-title')}>来源提示 · 非精确掉落表</div>
      <div className={cn('source-hint-grid')}>
        {items.map((hint, index) => {
          const encounters = Array.isArray(hint.encounters)
            ? hint.encounters
              .filter((encounter) => encounter?.label || encounter?.zh || encounter?.en || encounter?.key)
              .slice(0, 8)
            : [];
          return (
            <div className={cn('source-hint')} key={`${hint.kind || 'source'}-${hint.hash || index}-${hint.text}`}>
              <span>{hint.label || sourceKindLabel(hint.kind)}</span>
              <b>{hint.text}</b>
              {hint.description ? <p>{hint.description}</p> : null}
              {encounters.length ? (
                <div className={cn('source-encounters')}>
                  <span>掉落关卡</span>
                  <div>
                    {encounters.map((encounter, encounterIndex) => {
                      const label = encounter.label || encounter.zh || encounter.en || encounter.key;
                      return <em key={`${encounter.key || label}-${encounterIndex}`}>{label}</em>;
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArmorDetail({
  item,
  detail,
  onPerkClick
}: {
  item: JsonRecord;
  detail: JsonRecord;
  onPerkClick?: (perk: JsonRecord) => void;
}) {
  const setBonus = detail.setBonus;
  const intrinsicPerks = Array.isArray(detail.intrinsicPerks) ? detail.intrinsicPerks : [];
  return (
    <section className={cn('gear-detail-panel')}>
      <div className={cn('gear-detail-head')}>
        <img className={cn('gear-icon large')} src={item.icon || detail.icon || '/brand.svg'} alt="" />
        <div>
          <h3>{item.name || detail.name || '未知护甲'}</h3>
          <div className={cn('gear-tags')}>
            {[detail.slot, detail.className, detail.tier, detail.type].filter(Boolean).map((value, index) => <span className={cn('gear-tag')} key={gearTagKey(value, index)}>{value}</span>)}
          </div>
          {item.description ? <p className={cn('gear-description')}>{item.description}</p> : null}
        </div>
      </div>
      <SourceHints hints={detail.sourceHints || item.sourceHints || []} />
      {setBonus ? <ArmorSetBonus setBonus={setBonus} /> : <div className={cn('detail-loading')}>这件护甲没有公开的两件 / 四件套效果</div>}
      {intrinsicPerks.length ? <div className={cn('perk-columns armor-intrinsics')}><div className={cn('perk-column')}><h4>护甲特性</h4>{intrinsicPerks.map((perk: JsonRecord) => <PerkCard perk={perk} onPerkClick={onPerkClick} key={perk.hash || perk.name} />)}</div></div> : null}
    </section>
  );
}

function ArmorSetBonus({ setBonus }: { setBonus: JsonRecord }) {
  const perks = Array.isArray(setBonus.perks) ? setBonus.perks : [];
  return (
    <div className={cn('armor-set')}>
      <div className={cn('section-title')}>套装效果 · {setBonus.name || '-'}</div>
      <div className={cn('set-bonus-grid')}>
        {perks.length ? perks.map((perk: JsonRecord) => (
          <div className={cn('set-bonus-card')} key={perk.hash || perk.name}>
            <span>{perk.requiredSetCount} 件套</span>
            <b>{perk.name || '-'}</b>
            {perk.description ? <p>{perk.description}</p> : null}
          </div>
        )) : <div className={cn('detail-loading')}>没有套装效果说明</div>}
      </div>
    </div>
  );
}

function PerkWeapons({ payload, onPerkClick }: { payload: JsonRecord; onPerkClick?: (perk: JsonRecord) => void }) {
  const [pagePayload, setPagePayload] = React.useState<JsonRecord>(payload);
  const [page, setPage] = React.useState(0);
  const [loadingPage, setLoadingPage] = React.useState(false);
  const [pageError, setPageError] = React.useState('');
  const [selectedGroupKey, setSelectedGroupKey] = React.useState('');
  const currentPayload = pagePayload || payload;
  const weapons = Array.isArray(currentPayload.weapons) ? currentPayload.weapons : [];
  const perks = Array.isArray(currentPayload.perks) ? currentPayload.perks : [];
  const total = Number(currentPayload.total || weapons.length);
  const pageCount = Math.max(1, Math.ceil(total / PERK_WEAPON_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  React.useEffect(() => {
    setPagePayload(payload);
    setPage(Math.floor(Number(payload.offset || 0) / PERK_WEAPON_PAGE_SIZE) || 0);
    setPageError('');
    setSelectedGroupKey('');
  }, [payload]);

  const loadPage = async (nextPage: number) => {
    const targetPage = Math.max(0, Math.min(pageCount - 1, nextPage));
    const query = String(currentPayload.query || payload.query || '').trim();
    const hash = String(currentPayload.hash || payload.hash || '').trim();
    if (!query && !hash) return;
    setLoadingPage(true);
    setPageError('');
    try {
      const body: JsonRecord = {
        limit: PERK_WEAPON_PAGE_SIZE,
        offset: targetPage * PERK_WEAPON_PAGE_SIZE
      };
      if (query) body.query = query;
      if (hash) body.hash = hash;
      const nextPayload = await getPerkWeapons(body);
      setPagePayload(nextPayload);
      setPage(targetPage);
      setSelectedGroupKey('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Page load failed');
    } finally {
      setLoadingPage(false);
    }
  };

  return (
    <section className={cn('gear-detail-panel')}>
      <div className={cn('gear-summary')}>
        <b>Perk 反查：{currentPayload.query}</b>
        <span>命中 Perk {formatNumber(perks.length)} 个</span>
        <span>武器 {formatNumber(total)} 组</span>
      </div>
      {perks.length ? <div className={cn('perk-strip')}>{perks.slice(0, 12).map((perk: JsonRecord) => <PerkChip perk={perk} onPerkClick={onPerkClick} key={perk.hash || perk.name} />)}</div> : null}
      {pageError ? <div className={cn('notice error')}>{pageError}</div> : null}
      {loadingPage ? <div className={cn('detail-loading')}>加载中...</div> : null}
      {weapons.length ? (
        <>
          <div className={cn('weapon-group-list')}>
            {weapons.map((group: JsonRecord) => {
              const key = weaponGroupKey(group);
              const selected = key === selectedGroupKey;
              return (
                <React.Fragment key={key}>
                  <WeaponGroup
                    group={group}
                    selected={selected}
                    onSelect={() => setSelectedGroupKey(key)}
                  />
                  {selected ? (
                    <SelectedWeaponPerks group={group} onPerkClick={onPerkClick} onClose={() => setSelectedGroupKey('')} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
          {pageCount > 1 ? (
            <div className={cn('gear-pagination')}>
              <button
                type="button"
                aria-label="Previous perk weapon page"
                disabled={loadingPage || safePage <= 0}
                onClick={() => { void loadPage(safePage - 1); }}
              >
                上一页
              </button>
              <span>{safePage + 1} / {pageCount}</span>
              <button
                type="button"
                aria-label="Next perk weapon page"
                disabled={loadingPage || safePage >= pageCount - 1}
                onClick={() => { void loadPage(safePage + 1); }}
              >
                下一页
              </button>
            </div>
          ) : null}
        </>
      ) : <div className={cn('detail-loading')}>没有找到可出该 Perk 的武器</div>}
    </section>
  );
}

function WeaponGroup({
  group,
  selected,
  onSelect
}: {
  group: JsonRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const variants = Array.isArray(group.variants) ? group.variants : [];
  const primary = variants[0] || {};
  const sockets = Array.isArray(primary.sockets) ? primary.sockets : [];
  const frameSocket = sockets.find(isFrameSocket);
  const canRoll = [group.canRoll?.normal ? '普通可出' : '', group.canRoll?.enhanced ? '强化可出' : ''].filter(Boolean);
  const meta = [group.weaponType, group.ammo, group.element, `${variants.length} 个变体`].filter(Boolean);
  return (
    <article className={cn(`weapon-group ${selected ? 'selected' : ''}`)}>
      <img className={cn('gear-icon')} src={primary.icon || '/brand.svg'} alt="" />
      <div className={cn('gear-main')}>
        <div
          className={cn('gear-title gear-title-toggle')}
          onClick={onSelect}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect();
            }
          }}
          aria-pressed={selected}
        >
          <h3>{group.name || '未知武器'}</h3>
          <span>{selected ? '正在查看' : canRoll.join(' / ') || '查看词条'}</span>
        </div>
        <div className={cn('gear-tags')}>
          {meta.map((value, index) => <span className={cn('gear-tag')} key={gearTagKey(value, index)}>{value}</span>)}
          <InlineFrameSocket socket={frameSocket} />
        </div>
        <div className={cn('variant-pills')}>
          {variants.slice(0, 10).map((variant: JsonRecord) => <span key={variant.hash || variant.name}>{variant.name || '未知变体'}{variant.adept ? ' · 专家' : ''}</span>)}
          {variants.length > 10 ? <span>+{variants.length - 10}</span> : null}
        </div>
      </div>
    </article>
  );
}

function SelectedWeaponPerks({
  group,
  onPerkClick,
  onClose
}: {
  group: JsonRecord;
  onPerkClick?: (perk: JsonRecord) => void;
  onClose: () => void;
}) {
  const variants = Array.isArray(group.variants) ? group.variants : [];
  const primary = variants[0] || {};
  const sockets = Array.isArray(primary.sockets) ? primary.sockets : [];
  const frameSocket = sockets.find(isFrameSocket);
  const perkSockets = sockets.filter((socket: JsonRecord) => socket !== frameSocket);
  const canRoll = [group.canRoll?.normal ? '普通可出' : '', group.canRoll?.enhanced ? '强化可出' : ''].filter(Boolean);
  const meta = [group.weaponType, group.ammo, group.element, `${variants.length} 个变体`].filter(Boolean);

  return (
    <div className={cn('selected-perk-panel')} aria-live="polite">
      <div className={cn('selected-perk-head')}>
        <img className={cn('gear-icon')} src={primary.icon || '/brand.svg'} alt="" />
        <div>
          <h3>{group.name || '未知武器'}</h3>
          <div className={cn('gear-tags')}>
            {meta.map((value, index) => <span className={cn('gear-tag')} key={gearTagKey(value, index)}>{value}</span>)}
            {canRoll.length ? <span className={cn('gear-tag')}>{canRoll.join(' / ')}</span> : null}
            <InlineFrameSocket socket={frameSocket} />
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭武器词条详情">关闭</button>
      </div>
      <div className={cn('variant-pills selected-variants')}>
        {variants.slice(0, 12).map((variant: JsonRecord) => <span key={variant.hash || variant.name}>{variant.name || '未知变体'}{variant.adept ? ' · 专家' : ''}</span>)}
        {variants.length > 12 ? <span>+{variants.length - 12}</span> : null}
      </div>
      <PerkColumns sockets={perkSockets} onPerkClick={onPerkClick} />
    </div>
  );
}

function Stats({ stats }: { stats: JsonRecord[] }) {
  if (!stats.length) return null;
  return (
    <div className={cn('weapon-stat-list')}>
      {stats.map((stat) => {
        const max = Number(stat.displayMaximum || 100) || 100;
        const width = Math.max(3, Math.min(100, (Number(stat.value || 0) / max) * 100));
        return (
          <div className={cn('weapon-stat')} key={stat.name}>
            <span>{stat.name}</span>
            <b>{stat.value}</b>
            <i style={{ width: `${width}%` }}></i>
          </div>
        );
      })}
    </div>
  );
}

function PerkColumns({ sockets, recommendations = [], onPerkClick }: { sockets: JsonRecord[]; recommendations?: GearRollRecommendation[]; onPerkClick?: (perk: JsonRecord) => void }) {
  const recommendedByHash = React.useMemo(() => recommendationHashMap(recommendations), [recommendations]);
  if (!sockets.length) return <div className={cn('detail-loading')}>没有可展示的 Perk 池</div>;
  const originSocket = sockets.find(isOriginSocket);
  const frameSocket = sockets.find(isFrameOrIntrinsicSocket);
  const inlineOrigin = Boolean(originSocket && frameSocket);
  const displaySockets = inlineOrigin ? sockets.filter((socket) => socket !== originSocket) : sockets;
  return (
    <div className={cn('perk-columns')}>
      {displaySockets.map((socket) => (
        <div className={cn('perk-column')} key={socket.socketIndex || socket.label}>
          <h4>{socket.label || `第 ${Number(socket.socketIndex || 0) + 1} 列`}</h4>
          {(socket.perks || []).map((perk: JsonRecord) => <PerkCard perk={perk} recommendations={recommendedByHash.get(Number(perk.hash)) || []} onPerkClick={onPerkClick} key={perk.hash || perk.name} />)}
          {inlineOrigin && originSocket && socket === frameSocket ? (
            <div className={cn('perk-origin-inline')}>
              <h4>{originSocket.label || '起源特性'}</h4>
              {(originSocket.perks || []).map((perk: JsonRecord) => <PerkCard perk={perk} recommendations={recommendedByHash.get(Number(perk.hash)) || []} onPerkClick={onPerkClick} key={perk.hash || perk.name} />)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function isOriginSocket(socket: JsonRecord) {
  const label = String(socket.label || '');
  return label.includes('起源') || label.toLowerCase().includes('origin');
}

function isFrameOrIntrinsicSocket(socket: JsonRecord) {
  const label = String(socket.label || '');
  return label.includes('框架') || label.includes('固有') || label.toLowerCase().includes('frame') || label.toLowerCase().includes('intrinsic');
}

function PerkCard({ perk, recommendations = [], onPerkClick }: { perk: JsonRecord; recommendations?: GearRollRecommendation[]; onPerkClick?: (perk: JsonRecord) => void }) {
  const clickable = Boolean(onPerkClick && perk.hash);
  const badges = recommendationBadges(recommendations);
  const visibleBadges = badges.filter((badge) => !isPopularityBadge(badge.label));
  const popularityBadges = badges.filter((badge) => isPopularityBadge(badge.label));
  const championCounters = championCounterBadges(perk);
  const hasEffectValues = hasPerkEffectValues(perk);
  const enhanced = perkEnhancedLines(perk);
  const [showEffectValues, setShowEffectValues] = React.useState(false);
  const [showEnhanced, setShowEnhanced] = React.useState(false);
  const [showPopularity, setShowPopularity] = React.useState(false);
  return (
    <div
      className={cn(`perk-card ${perk.matched ? 'matched' : ''} ${clickable ? 'perk-card-clickable' : ''} ${showEffectValues || showEnhanced ? 'values-open' : ''}`)}
      onClick={clickable ? () => onPerkClick?.(perk) : undefined}
      onKeyDown={clickable ? (event) => event.key === 'Enter' && onPerkClick?.(perk) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <img src={perk.icon || '/brand.svg'} alt="" />
      <div>
        <b>{perk.name || '-'}</b>
        <span>{perkTypeLabel(perk)}</span>
        {perk.description ? <p>{perk.description}</p> : null}
        {championCounters.length ? (
          <div className={cn('perk-champion-badges')} aria-label="反勇士特性">
            {championCounters.map((counter) => (
              <em className={cn(`perk-champion-badge champion-${counter.type}`)} key={counter.type}>
                {counter.label}
              </em>
            ))}
          </div>
        ) : null}
        {visibleBadges.length ? (
          <div className={cn('perk-rec-badges')}>
            {visibleBadges.map((badge) => (
              <em
                className={cn(`perk-rec-badge perk-rec-badge-${badge.mode}`)}
                key={badge.key}
                title={badge.title}
              >
                {badge.label}
              </em>
            ))}
          </div>
        ) : null}
        {(popularityBadges.length || enhanced.length || hasEffectValues) ? (
          <div className={cn('perk-card-actions')}>
            {popularityBadges.length ? (
              <button
                type="button"
                className={cn('perk-popularity-toggle')}
                aria-expanded={showPopularity}
                onClick={(event) => {
                  event.stopPropagation();
                  setShowEffectValues(false);
                  setShowEnhanced(false);
                  setShowPopularity((value) => !value);
                }}
              >
                热度 {popularityBadges.length}
              </button>
            ) : null}
            {enhanced.length ? (
              <button
                type="button"
                className={cn('perk-enhanced-toggle')}
                aria-expanded={showEnhanced}
                onClick={(event) => {
                  event.stopPropagation();
                  setShowEffectValues(false);
                  setShowPopularity(false);
                  setShowEnhanced((value) => !value);
                }}
              >
                强化差异
              </button>
            ) : null}
            {hasEffectValues ? (
              <button
                type="button"
                className={cn('perk-effect-toggle')}
                aria-expanded={showEffectValues}
                onClick={(event) => {
                  event.stopPropagation();
                  setShowEnhanced(false);
                  setShowPopularity(false);
                  setShowEffectValues((value) => !value);
                }}
              >
                具体数值
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {showPopularity ? (
        <div className={cn('perk-info-popover perk-popularity-popover')} onClick={(event) => event.stopPropagation()}>
          <RecommendationNotes badges={popularityBadges} />
        </div>
      ) : null}
      {showEnhanced ? (
        <div className={cn('perk-info-popover perk-enhanced-popover')} onClick={(event) => event.stopPropagation()}>
          <EnhancedNotes perk={perk} />
        </div>
      ) : null}
      {showEffectValues ? (
        <div className={cn('perk-info-popover perk-effect-popover')} onClick={(event) => event.stopPropagation()}>
          <PerkEffectNotes perk={perk} />
        </div>
      ) : null}
    </div>
  );
}

function isPopularityBadge(label: string) {
  return String(label || '').startsWith('社区热度');
}

function championCounterBadges(perk: JsonRecord) {
  const counters = Array.isArray(perk.championCounters) ? perk.championCounters : [];
  return counters
    .map((counter: JsonRecord | string) => {
      if (typeof counter === 'string') return championCounterFromType(counter);
      return championCounterFromType(counter.type, counter.label);
    })
    .filter(Boolean) as Array<{ type: string; label: string }>;
}

function championCounterFromType(type: unknown, label?: unknown) {
  const value = String(type || '').toLowerCase();
  if (value === 'barrier') return { type: 'barrier', label: String(label || '反屏障') };
  if (value === 'overload') return { type: 'overload', label: String(label || '反过载') };
  if (value === 'unstoppable') return { type: 'unstoppable', label: String(label || '反势不可挡') };
  return null;
}

function RecommendationNotes({ badges }: { badges: ReturnType<typeof recommendationBadges> }) {
  return (
    <div className={cn('perk-popularity-notes')}>
      <strong>社区热度</strong>
      <ul>
        {badges.map((badge) => <li key={badge.key}>{badge.label.replace(/^社区热度\s*/, '')}</li>)}
      </ul>
    </div>
  );
}

function perkEnhancedLines(perk: JsonRecord) {
  const options = Array.isArray(perk.enhancedOptions) ? perk.enhancedOptions : [];
  return options.flatMap((option: JsonRecord) => enhancedLines(option));
}

function hasPerkEffectValues(perk: JsonRecord) {
  const normal = effectDetailsFrom(perk.effectDetails);
  const enhancedOptions = Array.isArray(perk.enhancedOptions) ? perk.enhancedOptions : [];
  const enhanced = enhancedOptions
    .map((option: JsonRecord) => effectDetailsFrom(option.effectDetails))
    .find((details) => details?.lines?.length);
  return Boolean(normal?.lines?.length || enhanced?.lines?.length);
}

function PerkEffectNotes({ perk }: { perk: JsonRecord }) {
  const normal = effectDetailsFrom(perk.effectDetails);
  const enhancedOptions = Array.isArray(perk.enhancedOptions) ? perk.enhancedOptions : [];
  const enhanced = enhancedOptions
    .map((option: JsonRecord) => effectDetailsFrom(option.effectDetails))
    .find((details) => details?.lines?.length);
  if (!normal?.lines?.length && !enhanced?.lines?.length) return null;

  return (
    <div className={cn('perk-effect-notes')}>
      <strong>具体数值</strong>
      {normal?.lines?.length ? <EffectLineGroup label="普通数值" details={normal} /> : null}
      {enhanced?.lines?.length ? <EffectLineGroup label="强化数值" details={enhanced} /> : null}
    </div>
  );
}

function EffectLineGroup({ label, details }: { label: string; details: GearPerkEffectDetails }) {
  return (
    <div className={cn('perk-effect-group')}>
      <span>{label}</span>
      <ul>
        {details.lines.slice(0, 6).map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}

function effectDetailsFrom(value: unknown): GearPerkEffectDetails | null {
  const details = value as GearPerkEffectDetails | null;
  if (!details || !Array.isArray(details.lines) || !details.lines.length) return null;
  return details;
}

function recommendationHashMap(recommendations: GearRollRecommendation[]) {
  const byHash = new Map<number, GearRollRecommendation[]>();
  for (const recommendation of recommendations) {
    for (const socket of recommendation.sockets || []) {
      for (const hash of socket.perkHashes || []) {
        const key = Number(hash);
        if (!Number.isFinite(key)) continue;
        const entries = byHash.get(key) || [];
        if (!entries.some((entry) => entry.id === recommendation.id)) entries.push(recommendation);
        byHash.set(key, entries);
      }
    }
  }
  return byHash;
}

function rollModeLabel(mode: GearRollRecommendation['mode'] | string) {
  if (mode === 'pve') return 'PvE';
  if (mode === 'pvp') return 'PvP';
  return '通用';
}

function recommendationBadges(recommendations: GearRollRecommendation[]) {
  const unique = Array.from(new Map(recommendations.map((entry) => [entry.id, entry])).values());
  const baseLabels = unique.map(recommendationBadgeLabel);
  const totals = new Map<string, number>();
  for (const label of baseLabels) totals.set(label, (totals.get(label) || 0) + 1);
  const occurrences = new Map<string, number>();

  return unique.map((recommendation, index) => {
    const baseLabel = baseLabels[index];
    const occurrence = (occurrences.get(baseLabel) || 0) + 1;
    occurrences.set(baseLabel, occurrence);
    const label = (totals.get(baseLabel) || 0) > 1 ? `${baseLabel} ${occurrence}` : baseLabel;
    const mode = recommendation.mode === 'pve' || recommendation.mode === 'pvp'
      ? recommendation.mode
      : 'general';
    return {
      key: recommendation.id || `${label}-${index}`,
      label,
      mode,
      title: [recommendation.label, recommendation.notes, recommendation.source]
        .filter(Boolean)
        .join(' · ')
    };
  });
}

function recommendationBadgeLabel(recommendation: GearRollRecommendation) {
  if (recommendation.source === 'light.gg') {
    return String(recommendation.label || 'Light.gg').trim() || 'Light.gg';
  }
  const mode = rollModeLabel(recommendation.mode);
  const label = String(recommendation.label || '').trim();
  if (!label) return mode;
  if (label.toLowerCase().includes(mode.toLowerCase())) return label;
  return `${mode} · ${label}`;
}

function EnhancedNotes({ perk }: { perk: JsonRecord }) {
  const options = Array.isArray(perk.enhancedOptions) ? perk.enhancedOptions : [];
  const lines = options.flatMap((option: JsonRecord) => enhancedLines(option));
  if (!lines.length) return null;
  return <div className={cn('perk-enhanced-notes')}>{lines.map((line: string) => <em key={line}>{line}</em>)}</div>;
}

function InlineFrameSocket({ socket }: { socket?: JsonRecord }) {
  const perk = socket?.perks?.[0];
  if (!perk) return null;
  const title = [socket.label, perk.name, perk.description].filter(Boolean).join(' · ');
  return (
    <span className={cn('gear-tag frame-inline')} title={title}>
      <img src={perk.icon || '/brand.svg'} alt="" />
      <span>{socket.label || '框架 / 固有'}</span>
      <b>{perk.name || '-'}</b>
    </span>
  );
}

function PerkChip({ perk, onPerkClick }: { perk: JsonRecord; onPerkClick?: (perk: JsonRecord) => void }) {
  const clickable = Boolean(onPerkClick && perk.hash);
  return (
    <button
      className={cn(`perk-chip ${clickable ? 'perk-chip-clickable' : ''}`)}
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onPerkClick?.(perk) : undefined}
    >
      <img src={perk.icon || '/brand.svg'} alt="" />
      <b>{perk.name || '未知 Perk'}</b>
      <em>{perk.enhanced ? '强化' : '普通'}</em>
    </button>
  );
}

function CatalystSection({ catalyst }: { catalyst: GearCatalyst }) {
  const statBonuses = Array.isArray(catalyst.statBonuses) ? catalyst.statBonuses : [];
  const hasProgressTarget = catalyst.killsRequired > 0 || Boolean(catalyst.progressDescription);
  return (
    <div className={cn('catalyst-box')}>
      <div className={cn('section-title')}>催化剂</div>
      <div className={cn('catalyst-perk-card')}>
        <img src={catalyst.perk.icon || '/brand.svg'} alt="" />
        <div>
          <b>{catalyst.perk.name}</b>
          <span>催化效果</span>
          {catalyst.perk.description ? <p>{catalyst.perk.description}</p> : null}
        </div>
      </div>
      {statBonuses.length ? (
        <div className={cn('catalyst-stat-bonuses')}>
          {statBonuses.map((stat, index) => (
            <span key={`${stat.name}-${index}`} className={cn('catalyst-stat-chip')}>
              {stat.name}&ensp;{stat.value > 0 ? `+${stat.value}` : stat.value}
            </span>
          ))}
        </div>
      ) : null}
      {hasProgressTarget ? (
        <div className={cn('catalyst-progress')}>
          <span className={cn('catalyst-progress-label')}>
            催化进度目标
          </span>
          {catalyst.killsRequired > 0 ? (
            <p className={cn('catalyst-progress-hint')}>
              需击杀 <b>{catalyst.killsRequired}</b> 个目标
            </p>
          ) : <p className={cn('catalyst-progress-hint')}>{catalyst.progressDescription}</p>}
        </div>
      ) : null}
    </div>
  );
}

function isFrameSocket(socket: JsonRecord) {
  const label = String(socket?.label || '');
  return label.includes('框架') || label.includes('固有');
}
