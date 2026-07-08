import { useCallback, useRef, useState } from 'react';

import { getCareerDetails, getCareerSummary } from '@frontend/lib/api';

import { type EndgameMode } from '@frontend/lib/career-merge';

import { loadEndgameModesProgressive } from '@frontend/lib/endgame-tasks';

import { COPY_BUNGIE_NAME_REQUIRED } from '@frontend/lib/copy';

import type { CareerSummaryDto } from '@frontend/lib/types';

import { useAbortableRequest } from './useAbortableRequest';



type LoadStrategy = 'eager' | 'lazy' | 'none';



type EndgameBaseRequest = {

  membershipType: number;

  membershipId: string;

  characters: CareerSummaryDto['characters'];

};



type UseCareerQueryOptions = {

  modes?: EndgameMode[];

  includeDetails?: boolean | 'lazy';

  loadEndgame?: LoadStrategy;

};



const DEFAULT_MODES: EndgameMode[] = ['raid', 'dungeon', 'pvp'];

function formatDetailError(err: unknown) {
  const message = err instanceof Error ? err.message : '详情加载失败';
  if (message === 'External request timed out') {
    return '成就与锻造数据请求超时，可点击上方「立即加载全部」重试';
  }
  return message;
}



export function useCareerQuery(options: UseCareerQueryOptions = {}) {

  const modes = options.modes ?? DEFAULT_MODES;

  const loadEndgame = options.loadEndgame ?? (modes.length ? 'eager' : 'none');

  const includeDetails = options.includeDetails ?? true;

  const detailsEager = includeDetails === true;

  const [career, setCareer] = useState<CareerSummaryDto | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const queryIdRef = useRef(0);

  const loadedEndgameRef = useRef<Set<EndgameMode>>(new Set());

  const detailsLoadedRef = useRef(false);

  const { begin, abort } = useAbortableRequest();



  const runDetails = useCallback(

    async (baseRequest: Record<string, unknown>, queryId: number, signal: AbortSignal) => {

      try {

        const details = await getCareerDetails(baseRequest, signal);

        if (queryIdRef.current !== queryId) return;

        detailsLoadedRef.current = true;

        setCareer((current) =>

          current

            ? {

                ...current,

                detailLoading: false,

                detailError: undefined,

                details: details.details,

                cache: { ...(current.cache || {}), ...(details.cache || {}) }

              }

            : current

        );

      } catch (err: unknown) {

        if (queryIdRef.current !== queryId) return;

        if (err instanceof DOMException && err.name === 'AbortError') {

          setCareer((current) =>

            current?.detailLoading ? { ...current, detailLoading: false } : current

          );

          return;

        }

        detailsLoadedRef.current = false;

        setCareer((current) =>

          current

            ? {

                ...current,

                detailLoading: false,

                detailError: formatDetailError(err)

              }

            : current

        );

      }

    },

    []

  );



  const runEndgame = useCallback(

    async (

      baseRequest: EndgameBaseRequest,

      modesToLoad: EndgameMode[],

      queryId: number,

      signal: AbortSignal,

      fullHistory = true

    ) => {

      if (!modesToLoad.length) return;

      setCareer((current) =>

        current

          ? {

              ...current,

              endgameLoading: {

                ...(typeof current.endgameLoading === 'object' ? current.endgameLoading : {}),

                ...Object.fromEntries(modesToLoad.map((mode) => [mode, true]))

              }

            }

          : current

      );

      await loadEndgameModesProgressive(baseRequest, modesToLoad, {

        isCancelled: () => queryIdRef.current !== queryId || signal.aborted,

        onUpdate: (updater) => setCareer((current) => (current ? updater(current) : current)),

        onModeLoaded: (mode) => loadedEndgameRef.current.add(mode),

        request: { fullHistory, signal }

      });

    },

    []

  );



  const ensureDetails = useCallback(

    async (options?: { reload?: boolean }) => {

      if (!career) return;

      if (options?.reload) {

        detailsLoadedRef.current = false;

      }

      if (detailsLoadedRef.current) return;

      const queryId = queryIdRef.current;

      const signal = begin('details');

      const baseRequest = {

        membershipType: career.account.membershipType,

        membershipId: career.account.membershipId

      };

      setCareer((current) =>

        current ? { ...current, detailLoading: true, detailError: undefined } : current

      );

      await runDetails(baseRequest, queryId, signal);

    },

    [begin, career, runDetails]

  );



  const ensureEndgameModes = useCallback(

    async (

      modesToLoad: EndgameMode[],

      options?: { fullHistory?: boolean; reload?: boolean }

    ) => {

      if (!career) return;

      if (options?.reload) {

        modesToLoad.forEach((mode) => loadedEndgameRef.current.delete(mode));

      }

      const pending = modesToLoad.filter((mode) => !loadedEndgameRef.current.has(mode));

      if (!pending.length) return;

      const queryId = queryIdRef.current;

      const signal = begin('endgame');

      const baseRequest = {

        membershipType: career.account.membershipType,

        membershipId: career.account.membershipId,

        characters: career.characters

      };

      await runEndgame(baseRequest, pending, queryId, signal, options?.fullHistory !== false);

    },

    [begin, career, runEndgame]

  );



  const query = useCallback(async (rawName: string): Promise<{ ok: boolean; error?: string }> => {

    const bungieName = rawName.trim();

    if (!bungieName) {

      const message = COPY_BUNGIE_NAME_REQUIRED;

      setError(message);

      setCareer(null);

      return { ok: false, error: message };

    }



    abort();

    const signal = begin('default');

    const queryId = ++queryIdRef.current;

    loadedEndgameRef.current = new Set();

    detailsLoadedRef.current = false;

    setLoading(true);

    setError('');

    setCareer(null);



    try {

      const summary = await getCareerSummary(bungieName, signal);

      if (queryIdRef.current !== queryId) return { ok: false };



      const endgameLoading =

        loadEndgame === 'eager'

          ? (Object.fromEntries(modes.map((mode) => [mode, true])) as Record<EndgameMode, boolean>)

          : undefined;



      setCareer({

        ...summary,

        detailLoading: detailsEager,

        endgameLoading

      });

      setLoading(false);



      const baseRequest = {

        membershipType: summary.account.membershipType,

        membershipId: summary.account.membershipId,

        characters: summary.characters

      };



      const tasks: Promise<void>[] = [];



      if (loadEndgame === 'eager') {

        tasks.push(runEndgame(baseRequest, modes, queryId, begin('endgame'), true));

      }



      if (detailsEager) {

        tasks.push(runDetails(baseRequest, queryId, begin('details')));

      }



      await Promise.allSettled(tasks);

      if (queryIdRef.current !== queryId) return { ok: false };

      return { ok: true };

    } catch (err: unknown) {

      if (queryIdRef.current !== queryId || (err instanceof DOMException && err.name === 'AbortError')) {

        return { ok: false };

      }

      setLoading(false);

      const message = err instanceof Error ? err.message : '查询失败';

      setError(message);

      return { ok: false, error: message };

    }

  }, [abort, begin, detailsEager, loadEndgame, modes, runDetails, runEndgame]);



  return {

    career,

    loading,

    error,

    query,

    setCareer,

    ensureDetails,

    ensureEndgameModes,

    clear: () => {

      abort();

      queryIdRef.current += 1;

      loadedEndgameRef.current = new Set();

      detailsLoadedRef.current = false;

      setCareer(null);

      setLoading(false);

      setError('');

    }

  };

}
