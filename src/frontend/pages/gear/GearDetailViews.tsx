import React from 'react';
import { formatNumber } from '@frontend/ui';
import type { JsonRecord } from '@frontend/lib/types';
import { cn } from './gear-cn';
import {
  enhancedLines,
  perkTypeLabel,
  sourceKindLabel
} from './gear-labels';

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
      <PerkColumns sockets={detail.sockets || []} onPerkClick={onPerkClick} />
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
            {[detail.slot, detail.className, detail.tier, detail.type].filter(Boolean).map((value) => <span className={cn('gear-tag')} key={value}>{value}</span>)}
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
  const weapons = Array.isArray(payload.weapons) ? payload.weapons : [];
  const perks = Array.isArray(payload.perks) ? payload.perks : [];
  return (
    <section className={cn('gear-detail-panel')}>
      <div className={cn('gear-summary')}>
        <b>Perk 反查：{payload.query}</b>
        <span>命中 Perk {formatNumber(perks.length)} 个</span>
        <span>武器 {formatNumber(payload.total || 0)} 组</span>
      </div>
      {perks.length ? <div className={cn('perk-strip')}>{perks.slice(0, 12).map((perk: JsonRecord) => <PerkChip perk={perk} onPerkClick={onPerkClick} key={perk.hash || perk.name} />)}</div> : null}
      {weapons.length ? <div className={cn('weapon-group-list')}>{weapons.map((group: JsonRecord) => <WeaponGroup group={group} onPerkClick={onPerkClick} key={group.hash || group.name} />)}</div> : <div className={cn('detail-loading')}>没有找到可出该 Perk 的武器</div>}
    </section>
  );
}

function WeaponGroup({ group, onPerkClick }: { group: JsonRecord; onPerkClick?: (perk: JsonRecord) => void }) {
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
        <PerkColumns sockets={perkSockets} onPerkClick={onPerkClick} />
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

function PerkColumns({ sockets, onPerkClick }: { sockets: JsonRecord[]; onPerkClick?: (perk: JsonRecord) => void }) {
  if (!sockets.length) return <div className={cn('detail-loading')}>没有可展示的 Perk 池</div>;
  return (
    <div className={cn('perk-columns')}>
      {sockets.map((socket) => (
        <div className={cn('perk-column')} key={socket.socketIndex || socket.label}>
          <h4>{socket.label || `第 ${Number(socket.socketIndex || 0) + 1} 列`}</h4>
          {(socket.perks || []).map((perk: JsonRecord) => <PerkCard perk={perk} onPerkClick={onPerkClick} key={perk.hash || perk.name} />)}
        </div>
      ))}
    </div>
  );
}

function PerkCard({ perk, onPerkClick }: { perk: JsonRecord; onPerkClick?: (perk: JsonRecord) => void }) {
  const clickable = Boolean(onPerkClick && perk.hash);
  return (
    <div
      className={cn(`perk-card ${perk.matched ? 'matched' : ''} ${clickable ? 'perk-card-clickable' : ''}`)}
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

function isFrameSocket(socket: JsonRecord) {
  const label = String(socket?.label || '');
  return label.includes('框架') || label.includes('固有');
}
