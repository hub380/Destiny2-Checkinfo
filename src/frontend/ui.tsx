import type { ReactNode } from 'react';
import type { StatDto } from './types';

export const BRAND_LOGO = 'https://imgheybox.max-c.com/oa/2026/06/11/3271d1932bba2fe079e7305532ce2367.png';

export function Header({ title, subtitle, current }: { title: string; subtitle: string; current: 'home' | 'career' | 'gear' }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src={BRAND_LOGO} alt="" className="brand-mark" />
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <nav className="main-nav" aria-label="主导航">
        <a href="/" className={current === 'home' ? 'current' : ''}>组队</a>
        <a href="/career.html" className={current === 'career' ? 'current' : ''}>玩家生涯</a>
        <a href="/gear.html" className={current === 'gear' ? 'current' : ''}>装备搜索</a>
      </nav>
    </header>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 8h10v12H8z" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function Notice({ message, error = false }: { message?: string; error?: boolean }) {
  return <div className={`notice${message ? '' : ' hidden'}${error ? ' error' : ''}`}>{message || ''}</div>;
}

export function MetricCard({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="career-metric-card">
      <span>{label}</span>
      <b>{value ?? '-'}</b>
      <em>{note || ''}</em>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="career-mini-stat">
      <span>{label}</span>
      <b>{value ?? '-'}</b>
    </div>
  );
}

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

export function winRate(pvp: any): string {
  const won = Number(pvp?.activitiesWon?.value || pvp?.wins?.value || 0);
  const entered = Number(pvp?.activitiesEntered?.value || pvp?.attempts?.value || 0);
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
