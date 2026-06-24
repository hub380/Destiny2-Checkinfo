import { useCallback, useEffect, useRef, useState } from 'react';
import { getHeyboxTeams } from '@frontend/lib/api';
import type { FireteamDto, FireteamsResponseDto } from '@frontend/lib/types';

export function useHeyboxFeed(refreshSeconds = 30) {
  const [items, setItems] = useState<FireteamDto[]>([]);
  const [payload, setPayload] = useState<FireteamsResponseDto | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(refreshSeconds);
  const nextRefreshAt = useRef<number | undefined>(undefined);
  const refreshTimer = useRef<number | undefined>(undefined);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setNotice('');
    try {
      const data = await getHeyboxTeams();
      setPayload(data);
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.warning) {
        setNotice(data.warning);
        setNoticeError(false);
      }
      nextRefreshAt.current = Date.now() + refreshSeconds * 1000;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '刷新失败';
      setNotice(message);
      setNoticeError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [refreshSeconds]);

  useEffect(() => {
    void refresh();
    return () => window.clearTimeout(refreshTimer.current);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!autoRefresh) {
        setCountdown(0);
        return;
      }
      setCountdown(Math.max(Math.ceil(((nextRefreshAt.current ?? Date.now()) - Date.now()) / 1000), 0));
    }, 500);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    window.clearTimeout(refreshTimer.current);
    if (!autoRefresh || document.hidden) return;
    const delay = Math.max((nextRefreshAt.current ?? Date.now()) - Date.now(), 1000);
    refreshTimer.current = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(refreshTimer.current);
  }, [autoRefresh, payload?.updatedAt, refresh]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden && autoRefresh) void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [autoRefresh, refresh]);

  const reportNotice = useCallback((message: string, error = false) => {
    setNotice(message);
    setNoticeError(error);
  }, []);

  return {
    items,
    payload,
    notice,
    noticeError,
    loading,
    autoRefresh,
    setAutoRefresh,
    countdown,
    refresh,
    reportNotice
  };
}

/** @deprecated Use `useHeyboxFeed`. */
export const useFireteamFeed = useHeyboxFeed;
