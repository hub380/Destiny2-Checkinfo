import type { StatDto } from './types';

export function statDisplay(stat: StatDto | undefined | null): string {
  if (!stat) return '-';
  return String(stat.displayValue ?? formatNumber(stat.value));
}

export function formatNumber(value: unknown): string {
  if (value == null || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(number);
}

export function formatTime(value?: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

export function dateOnly(value?: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

export function dateTime(value?: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatMinutes(minutes: unknown): string {
  const value = Number(minutes || 0);
  if (!value) return '-';
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value / 60))} 小时`;
}

export function winRate(pvp: Record<string, unknown> | undefined | null): string {
  const won = Number((pvp?.activitiesWon as StatDto)?.value || (pvp?.wins as StatDto)?.value || 0);
  const entered = Number((pvp?.activitiesEntered as StatDto)?.value || (pvp?.attempts as StatDto)?.value || 0);
  if (!entered) return '-';
  return `${((won / entered) * 100).toFixed(1)}%`;
}

export function privacyText(value: unknown): string {
  if (value === 'private') return '隐私受限';
  if (value === 'public') return '公开';
  return '公开组件';
}

export function relativeTime(value?: string): string {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return dateOnly(value);
}
