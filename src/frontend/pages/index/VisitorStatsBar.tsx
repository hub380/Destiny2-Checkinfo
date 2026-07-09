import { useVisitorStats } from '@frontend/hooks';
import { cn } from './home-cn';

function formatUptime(startedAt: number | null): string {
  if (!startedAt) return '-';
  const elapsed = Math.max(0, Date.now() - startedAt);
  const days = Math.floor(elapsed / 86_400_000);
  const hours = Math.floor((elapsed % 86_400_000) / 3_600_000);
  const minutes = Math.floor((elapsed % 3_600_000) / 60_000);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}

export function VisitorStatsBar() {
  const stats = useVisitorStats(60_000);
  if (!stats) return null;
  return (
    <div className={cn('visitor-stats-bar')}>
      <span title="5 分钟内活跃独立用户">当前在线 {stats.onlineCount} 人</span>
      <span className={cn('stats-sep')}>·</span>
      <span title="历史独立访客总数">已服务 {stats.totalCount.toLocaleString('zh-CN')} 人</span>
      <span className={cn('stats-sep')}>·</span>
      <span title="首次访客以来的运行时长">运行时间 {formatUptime(stats.startedAt)}</span>
    </div>
  );
}
