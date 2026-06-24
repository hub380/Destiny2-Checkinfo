import React, { useEffect, useRef, useState } from 'react';
import { MiniStat, Notice, formatNumber, privacyText, statDisplay } from '@frontend/ui';
import type { CraftingItemDto, CraftingSourceGroupDto, CraftingSummaryDto } from '@frontend/lib/types';
import { cn } from './career-cn';
import {
  buildCraftingGroups,
  craftingPatternLabel,
  craftingPatternPercent,
  isCraftingPatternComplete
} from './career-utils';

export function CraftingPanel({ crafting, loading, error }: { crafting: CraftingSummaryDto; loading?: boolean; error?: string }) {
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

function CraftingModal({
  crafting,
  groups,
  onClose
}: {
  crafting: CraftingSummaryDto;
  groups: CraftingSourceGroupDto[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className={cn('career-modal')}>
      <div className={cn('career-modal-backdrop')} onClick={onClose}></div>
      <div className={cn('career-modal-panel')} ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="craftingModalTitle">
        <div className={cn('career-modal-head')}>
          <div>
            <h3 id="craftingModalTitle">锻造进度</h3>
            <span>{privacyText(crafting.privacy)}</span>
          </div>
          <button className={cn('icon-button')} ref={closeRef} type="button" onClick={onClose} aria-label="关闭">×</button>
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

function CraftingSourceGroup({ group }: { group: CraftingSourceGroupDto }) {
  return (
    <article className={cn(`crafting-source-group ${group.complete >= group.total && group.total ? 'complete' : ''}`)}>
      <div className={cn('crafting-source-head')}>
        <strong>{group.source}</strong>
        <span>收集进度：{formatNumber(group.complete)}/{formatNumber(group.total)}</span>
      </div>
      <div className={cn('crafting-source-items')}>
        {group.items.map((item) => <CraftingBoardItem item={item} key={item.hash} />)}
      </div>
    </article>
  );
}

function CraftingBoardItem({ item }: { item: CraftingItemDto }) {
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
