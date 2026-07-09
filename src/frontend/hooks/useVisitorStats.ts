import { useEffect, useState } from 'react';

export interface VisitorStats {
  onlineCount: number;
  totalCount: number;
  startedAt: number | null;
}

export function useVisitorStats(intervalMs = 60_000) {
  const [stats, setStats] = useState<VisitorStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) return;
        const data: VisitorStats = await response.json();
        if (!cancelled) setStats(data);
      } catch {
        // Stats are informational only.
      }
    }

    void load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return stats;
}
