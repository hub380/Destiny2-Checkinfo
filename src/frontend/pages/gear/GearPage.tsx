import React from 'react';
import { useGearSearch } from '@frontend/hooks';
import {
  AppShell,
  FadeIn,
  Notice,
  PageEmpty,
  PageLoading,
  PageSection,
  SearchIcon,
  StaggerList,
  createPageCn,
  formatNumber
} from '@frontend/ui';
import type { JsonRecord } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import styles from './gear.module.css';

const cn = createPageCn(styles);

export function GearPage() {
  const {
    query,
    setQuery,
    payload,
    detail,
    subtitle,
    notice,
    error,
    openItem,
    onSubmit
  } = useGearSearch();

  const items = Array.isArray(payload?.items) ? payload.items : [];

  return (
    <AppShell title="Destiny 2 装备搜索" subtitle="统一搜索武器、护甲、Perk 与可出武器" current="gear">
      <FadeIn variant="page" className={cn('layout gear-layout')}>
        <PageSection className={cn('panel gear-panel')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>装备搜索</h2>
              <p>{subtitle}</p>
            </div>
          </div>
          <form className={cn('gear-search')} onSubmit={onSubmit}>
            <div className={cn('gear-query searchFocus')}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" spellCheck={false} placeholder="灾变 / 诱导推销 / 狂野飞禽" />
              <button type="submit">
                <SearchIcon />
                查询
              </button>
            </div>
          </form>
          <Notice message={notice} error={error} />
          <div className={cn(`gear-result ${payload ? '' : 'empty'}`)}>
            {!payload ? (
              detail?.loading ? (
                <PageLoading className={cn('detail-loading')}>{detail.message}</PageLoading>
              ) : (
                <PageEmpty>输入装备或 Perk 名称开始查询</PageEmpty>
              )
            ) : (
              <>
                <div className={cn('gear-summary')}>
                  <b>{payload.query}</b>
                  <span>显示 {formatNumber(items.length)} / {formatNumber(payload.total || 0)}</span>
                </div>
                <GearDetailSlot detail={detail} />
                <StaggerList className={cn('gear-grid')}>
                  {items.length ? items.map((item) => <GearResultCard item={item} onOpen={() => openItem(item)} key={`${item.kind}-${item.hash}`} />) : <div className={cn('detail-loading')}>没有匹配的装备数据</div>}
                </StaggerList>
              </>
            )}
          </div>
        </PageSection>
      </FadeIn>
    </AppShell>
  );
}

function GearResultCard({ item, onOpen }: { item: JsonRecord; onOpen: () => void }) {
  const meta = gearMeta(item);
  const action = item.kind === 'perk' ? '反查武器' : '查看详情';
  return (
    <button className={cn('gear-card gear-card-button cardHover')} type="button" onClick={onOpen}>
      <img className={cn('gear-icon')} src={item.icon || '/brand.svg'} alt="" />
      <div className={cn('gear-main')}>
        <div className={cn('gear-title')}>
          <h3>{item.name || '未知装备'}</h3>
          <span>{gearKindLabel(item.kind)}</span>
        </div>
        {meta.length ? <div className={cn('gear-tags')}>{meta.map((value) => <span className={cn('gear-tag')} key={value}>{value}</span>)}</div> : null}
        {item.description ? <p className={cn('gear-description')}>{item.description}</p> : null}
        {primarySourceLabel(item) ? <p className={cn('gear-source-line')}>来源：{primarySourceLabel(item)}</p> : null}
        <div className={cn('gear-card-foot')}>
          <b>{action}</b>
        </div>
      </div>
    </button>
  );
}

function GearDetailSlot({ detail }: { detail: JsonRecord | null }) {
  if (!detail) return <div className={cn('gear-detail-slot')}></div>;
  if (detail.loading) return <div className={cn('gear-detail-slot')}><div className={cn('detail-loading')}>{detail.message}</div></div>;
  if (detail.error) return <div className={cn('gear-detail-slot')}><div className={cn('notice error')}>{detail.error}</div></div>;
  if (detail.weapons || detail.perks) return <div className={cn('gear-detail-slot')}><PerkWeapons payload={detail} /></div>;
  return <div className={cn('gear-detail-slot')}><GearDetail item={detail.item} detail={detail.detail} /></div>;
}

function GearDetail({ item, detail }: { item: JsonRecord; detail: JsonRecord }) {
  if (!item || !detail) return <div className={cn('detail-loading')}>没有可展示的详情</div>;
  if (item.kind === 'weapon') return <WeaponDetail item={item} detail={detail} />;
  if (item.kind === 'armor') return <ArmorDetail item={item} detail={detail} />;
  return <div className={cn('detail-loading')}>点击 Perk 可反查支持该 Perk 的武器</div>;
}

function WeaponDetail({ item, detail }: { item: JsonRecord; detail: JsonRecord }) {
  return (
    <section className={cn('gear-detail-panel')}>
      <div className={cn('gear-detail-head')}>
        <img className={cn('gear-icon large')} src={item.icon || detail.icon || '/brand.svg'} alt="" />
        <div>
          <h3>{item.name || detail.name || '未知武器'}</h3>
          <div className={cn('gear-tags')}>
            {[detail.weaponType, detail.ammo, detail.element, detail.adept ? '专家' : ''].filter(Boolean).map((value) => <span className={cn('gear-tag')} key={value}>{value}</span>)}
          </div>
          {item.description ? <p className={cn('gear-description')}>{item.description}</p> : null}
        </div>
      </div>
      <SourceHints hints={detail.sourceHints || item.sourceHints || []} />
      <Stats stats={detail.stats || []} />
      <PerkColumns sockets={detail.sockets || []} />
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
        {items.map((hint, index) => (
          <div className={cn('source-hint')} key={`${hint.kind || 'source'}-${hint.hash || index}-${hint.text}`}>
            <span>{hint.label || sourceKindLabel(hint.kind)}</span>
            <b>{hint.text}</b>
            {hint.description ? <p>{hint.description}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArmorDetail({ item, detail }: { item: JsonRecord; detail: JsonRecord }) {
  const setBonus = detail.setBonus;
  const intrinsicPerks = Array.isArray(detail.intrinsicPerks) ? detail.intrinsicPerks : [];
  return (
    <section className={cn('gear-detail-panel')}>
      <div className={cn('gear-detail-head')}>
        <img className={cn('gear-icon large')} src={item.icon || detail.icon || '/brand.svg'} alt="" />
        <div>
          <h3>{item.name || detail.name || '未知护甲'}</h3>
          <div className={cn('gear-tags')}>
            {[detail.slot, detail.className, detail.tier, detail.type].filter(Boolean).map((value) => <span className={cn('gear-tag')} key={value}>{value}</span>)}
          </div>
          {item.description ? <p className={cn('gear-description')}>{item.description}</p> : null}
        </div>
      </div>
      <SourceHints hints={detail.sourceHints || item.sourceHints || []} />
      {setBonus ? <ArmorSetBonus setBonus={setBonus} /> : <div className={cn('detail-loading')}>这件护甲没有公开的两件 / 四件套效果</div>}
      {intrinsicPerks.length ? <div className={cn('perk-columns armor-intrinsics')}><div className={cn('perk-column')}><h4>护甲特性</h4>{intrinsicPerks.map((perk: JsonRecord) => <PerkCard perk={perk} key={perk.hash || perk.name} />)}</div></div> : null}
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

function PerkWeapons({ payload }: { payload: JsonRecord }) {
  const weapons = Array.isArray(payload.weapons) ? payload.weapons : [];
  const perks = Array.isArray(payload.perks) ? payload.perks : [];
  return (
    <section className={cn('gear-detail-panel')}>
      <div className={cn('gear-summary')}>
        <b>Perk 反查：{payload.query}</b>
        <span>命中 Perk {formatNumber(perks.length)} 个</span>
        <span>武器 {formatNumber(payload.total || 0)} 组</span>
      </div>
      {perks.length ? <div className={cn('perk-strip')}>{perks.slice(0, 12).map((perk: JsonRecord) => <PerkChip perk={perk} key={perk.hash || perk.name} />)}</div> : null}
      {weapons.length ? <div className={cn('weapon-group-list')}>{weapons.map((group: JsonRecord) => <WeaponGroup group={group} key={group.hash || group.name} />)}</div> : <div className={cn('detail-loading')}>没有找到可出该 Perk 的武器</div>}
    </section>
  );
}

function WeaponGroup({ group }: { group: JsonRecord }) {
  const variants = Array.isArray(group.variants) ? group.variants : [];
  const primary = variants[0] || {};
  const sockets = Array.isArray(primary.sockets) ? primary.sockets : [];
  const frameSocket = sockets.find(isFrameSocket);
  const perkSockets = sockets.filter((socket: JsonRecord) => socket !== frameSocket);
  const canRoll = [group.canRoll?.normal ? '普通可出' : '', group.canRoll?.enhanced ? '强化可出' : ''].filter(Boolean);
  const meta = [group.weaponType, group.ammo, group.element, `${variants.length} 个变体`].filter(Boolean);
  return (
    <article className={cn('weapon-group expanded')}>
      <img className={cn('gear-icon')} src={primary.icon || '/brand.svg'} alt="" />
      <div className={cn('gear-main')}>
        <div className={cn('gear-title')}>
          <h3>{group.name || '未知武器'}</h3>
          <span>{canRoll.join(' / ') || '可出'}</span>
        </div>
        <div className={cn('gear-tags')}>
          {meta.map((value) => <span className={cn('gear-tag')} key={value}>{value}</span>)}
          <InlineFrameSocket socket={frameSocket} />
        </div>
        <div className={cn('variant-pills')}>
          {variants.slice(0, 10).map((variant: JsonRecord) => <span key={variant.hash || variant.name}>{variant.name || '未知变体'}{variant.adept ? ' · 专家' : ''}</span>)}
          {variants.length > 10 ? <span>+{variants.length - 10}</span> : null}
        </div>
        <PerkColumns sockets={perkSockets} />
      </div>
    </article>
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

function PerkColumns({ sockets }: { sockets: JsonRecord[] }) {
  if (!sockets.length) return <div className={cn('detail-loading')}>没有可展示的 Perk 池</div>;
  return (
    <div className={cn('perk-columns')}>
      {sockets.map((socket) => (
        <div className={cn('perk-column')} key={socket.socketIndex || socket.label}>
          <h4>{socket.label || `第 ${Number(socket.socketIndex || 0) + 1} 列`}</h4>
          {(socket.perks || []).map((perk: JsonRecord) => <PerkCard perk={perk} key={perk.hash || perk.name} />)}
        </div>
      ))}
    </div>
  );
}

function PerkCard({ perk }: { perk: JsonRecord }) {
  return (
    <div className={cn(`perk-card ${perk.matched ? 'matched' : ''}`)}>
      <img src={perk.icon || '/brand.svg'} alt="" />
      <div>
        <b>{perk.name || '-'}</b>
        <span>{perkTypeLabel(perk)}</span>
        {perk.description ? <p>{perk.description}</p> : null}
        <EnhancedNotes perk={perk} />
      </div>
    </div>
  );
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

function PerkChip({ perk }: { perk: JsonRecord }) {
  return (
    <span className={cn('perk-chip')}>
      <img src={perk.icon || '/brand.svg'} alt="" />
      <b>{perk.name || '未知 Perk'}</b>
      <em>{perk.enhanced ? '强化' : '普通'}</em>
    </span>
  );
}

function isFrameSocket(socket: JsonRecord) {
  const label = String(socket?.label || '');
  return label.includes('框架') || label.includes('固有');
}

function gearMeta(item: JsonRecord) {
  if (item.kind === 'weapon') return [item.type, item.ammo, item.element, item.tier, item.adept ? '专家' : ''].filter(Boolean);
  if (item.kind === 'armor') return [item.slot, item.className, item.tier, item.type].filter(Boolean);
  if (item.kind === 'perk') return [item.enhanced ? '强化 Perk' : '普通 Perk', item.type, '点击反查武器'].filter(Boolean);
  return [item.type].filter(Boolean);
}

function primarySourceLabel(item: JsonRecord) {
  const hints = Array.isArray(item.sourceHints) ? item.sourceHints : [];
  const first = hints.find((hint) => hint?.text);
  return first?.text || item.source || '';
}

function gearKindLabel(kind: string) {
  const labels: Record<string, string> = { weapon: '武器', armor: '护甲', perk: 'Perk', all: '全部' };
  return labels[kind] || '装备';
}

function sourceKindLabel(kind?: string) {
  const labels: Record<string, string> = {
    crafting: '锻造配方',
    collectible: '收藏品来源',
    displaySource: '物品来源',
    rewardSource: '奖励来源',
    vendor: 'Vendor 来源'
  };
  return labels[String(kind || '')] || '来源提示';
}

function perkTypeLabel(perk: JsonRecord) {
  if (Array.isArray(perk.enhancedOptions) && perk.enhancedOptions.length) return `${perk.type || '普通'} / 可强化`;
  return perk.enhanced ? '强化' : perk.type || '普通';
}

function enhancedLines(option: JsonRecord) {
  const statText = formatEnhancedStatDiff(option.statDiff || []);
  const description = option.descriptionDiff || '';
  const lines = [];
  if (statText) lines.push(`强化后：${statText}`);
  if (!statText && description) lines.push(`强化后：${description}`);
  if (statText && description) lines.push(`强化说明：${description}`);
  return lines;
}

function formatEnhancedStatDiff(stats: JsonRecord[]) {
  return stats.map((stat) => {
    const enhanced = signedNumber(stat.enhanced);
    const delta = signedNumber(stat.delta);
    const condition = stat.conditionallyActive ? '，条件触发' : '';
    if (Number(stat.normal || 0) === 0) return `${stat.name} ${enhanced}${condition}`;
    return `${stat.name} ${enhanced}（${delta}）${condition}`;
  }).join('、');
}

function signedNumber(value: unknown) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

