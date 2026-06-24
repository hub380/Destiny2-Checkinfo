import { useCallback, useRef, useState } from 'react';
import { getCareerDetails, getCareerSummary } from '@frontend/lib/api';
import { type EndgameMode } from '@frontend/lib/career-merge';
import { loadEndgameModesProgressive } from '@frontend/lib/endgame-tasks';
import type { CareerSummaryDto } from '@frontend/lib/types';

type UseCareerQueryOptions = {
  modes?: EndgameMode[];
  includeDetails?: boolean;
};

const DEFAULT_MODES: EndgameMode[] = ['raid', 'dungeon', 'pvp'];

export function useCareerQuery(options: UseCareerQueryOptions = {}) {
  const modes = options.modes ?? DEFAULT_MODES;
  const includeDetails = options.includeDetails ?? true;
  const [career, setCareer] = useState<CareerSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queryIdRef = useRef(0);

  const query = useCallback(async (rawName: string): Promise<{ ok: boolean; error?: string }> => {
    const bungieName = rawName.trim();
    if (!bungieName) {
      const message = '请输入棒鸡名称，格式为 名称#数字代码';
      setError(message);
      setCareer(null);
      return { ok: false, error: message };
    }

    const queryId = ++queryIdRef.current;
    setLoading(true);
    setError('');
    setCareer(null);

    try {
      const summary = await getCareerSummary(bungieName);
      if (queryIdRef.current !== queryId) return { ok: false };

      const endgameLoading = Object.fromEntries(modes.map((mode) => [mode, true])) as Record<EndgameMode, boolean>;
      setCareer({
        ...summary,
        detailLoading: includeDetails,
        endgameLoading
      });
      setLoading(false);

      const baseRequest = {
        membershipType: summary.account.membershipType,
        membershipId: summary.account.membershipId,
        characters: summary.characters
      };

      const tasks: Promise<void>[] = [
        loadEndgameModesProgressive(baseRequest, modes, {
          isCancelled: () => queryIdRef.current !== queryId,
          onUpdate: (updater) => setCareer((current) => (current ? updater(current) : current))
        })
      ];

      if (includeDetails) {
        tasks.push(
          getCareerDetails(baseRequest)
            .then((details) => {
              if (queryIdRef.current !== queryId) return;
              setCareer((current) =>
                current
                  ? {
                      ...current,
                      detailLoading: false,
                      details: details.details,
                      cache: { ...(current.cache || {}), ...(details.cache || {}) }
                    }
                  : current
              );
            })
            .catch((err: unknown) => {
              if (queryIdRef.current !== queryId) return;
              setCareer((current) =>
                current
                  ? {
                      ...current,
                      detailLoading: false,
                      detailError: err instanceof Error ? err.message : '详情加载失败'
                    }
                  : current
              );
            })
        );
      }

      await Promise.allSettled(tasks);
      if (queryIdRef.current !== queryId) return { ok: false };
      return { ok: true };
    } catch (err: unknown) {
      if (queryIdRef.current !== queryId) return { ok: false };
      setLoading(false);
      const message = err instanceof Error ? err.message : '查询失败';
      setError(message);
      return { ok: false, error: message };
    }
  }, [includeDetails, modes]);

  return {
    career,
    loading,
    error,
    query,
    setCareer,
    clear: () => {
      queryIdRef.current += 1;
      setCareer(null);
      setLoading(false);
      setError('');
    }
  };
}
