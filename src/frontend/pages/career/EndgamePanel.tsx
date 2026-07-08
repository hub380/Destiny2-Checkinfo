import { MiniStat, ActionNotice, dateOnly, statDisplay } from '@frontend/ui';
import type { EndgameActivityDto, EndgameStatBlockDto, EndgameVariantDto } from '@frontend/lib/types';
import { cn } from './career-cn';

export function EndgamePanel({
  label,
  mode,
  loading,
  error,
  lazyPending
}: {
  label: string;
  mode: EndgameStatBlockDto;
  loading: boolean;
  error?: string;
  lazyPending?: boolean;
}) {
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
      <ActionNotice message={error} error />
      <div className={cn('career-activity-grid')}>
        {activities.length ? activities.map((activity) => <EndgameActivity activity={activity} key={`${label}-${activity.name}`} />) : (
          <div className={cn('detail-loading')}>
            {loading ? '活动历史加载中' : lazyPending ? '即将自动加载完整活动历史' : '没有公开活动历史'}
          </div>
        )}
      </div>
    </article>
  );
}

function EndgameActivity({ activity }: { activity: EndgameActivityDto }) {
  const variants = Array.isArray(activity.variants) ? activity.variants : [];
  return (
    <div className={cn('career-activity-card')}>
      <img src={activity.image || '/brand.svg'} alt="" />
      <div className={cn('activity-detail-main')}>
        <div>
          <b>{activity.name || '未知活动'}</b>
          <span>{(activity.variantCount ?? 0) > 1 ? `${activity.variantCount} 个变体` : '单一变体'}</span>
          {activity.name ? (
            <a className={cn('activity-guide-link')} href={`/guides.html?q=${encodeURIComponent(activity.name)}`}>攻略</a>
          ) : null}
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
          {variants.slice(0, 8).map((variant: EndgameVariantDto) => (
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

function EndgameTags({ item }: { item: EndgameActivityDto }) {
  const tags = [];
  const solo = Number(item.soloClears?.value || 0);
  const soloFlawless = Number(item.soloFlawlessClears?.value || 0);
  if (solo > 0) tags.push(`Solo x${solo}`);
  if (soloFlawless > 0) tags.push(`Solo 无暇 x${soloFlawless}`);
  if (!tags.length) return null;
  return <div className={cn('activity-tags')}>{tags.map((tag) => <em key={tag}>{tag}</em>)}</div>;
}
