import { useCallback, useEffect, useRef, useState } from 'react';
import type { EndgameMode } from '@frontend/lib/career-merge';
import type { CareerSummaryDto } from '@frontend/lib/types';

export type CareerProgressStage = 'idle' | 'details' | 'endgame' | 'pvp' | 'done';

const INITIAL_DELAY_MS = 80;
const BETWEEN_STAGES_MS = 120;

type EnsureEndgame = (
  modes: EndgameMode[],
  options?: { fullHistory?: boolean; reload?: boolean }
) => void | Promise<void>;

type EnsureDetails = (options?: { reload?: boolean }) => void | Promise<void>;

function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

function shouldSkipDelays(career: CareerSummaryDto | null) {
  if (!career?.cache) return false;
  const values = Object.values(career.cache);
  return values.some((value) => typeof value === 'string' && value.includes('hit'));
}

type UseCareerProgressiveLoadOptions = {
  career: CareerSummaryDto | null;
  enabled?: boolean;
  ensureDetails?: EnsureDetails;
  ensureEndgameModes?: EnsureEndgame;
};

export function useCareerProgressiveLoad({
  career,
  enabled = true,
  ensureDetails,
  ensureEndgameModes
}: UseCareerProgressiveLoadOptions) {
  const [stage, setStage] = useState<CareerProgressStage>('idle');
  const pipelineKeyRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const ensureDetailsRef = useRef(ensureDetails);
  const ensureEndgameModesRef = useRef(ensureEndgameModes);
  const enabledRef = useRef(enabled);
  const careerRef = useRef(career);

  useEffect(() => {
    ensureDetailsRef.current = ensureDetails;
    ensureEndgameModesRef.current = ensureEndgameModes;
    enabledRef.current = enabled;
    careerRef.current = career;
  }, [career, enabled, ensureDetails, ensureEndgameModes]);

  const careerKey = career
    ? `${career.account?.membershipId || ''}:${career.queriedName || ''}`
    : '';

  const runPipeline = useCallback(async (fullLoad = false) => {
    if (!enabledRef.current || !careerKey) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const skipDelays = fullLoad || shouldSkipDelays(careerRef.current);

    try {
      if (!skipDelays) await sleep(INITIAL_DELAY_MS, signal);
      setStage('details');
      await ensureDetailsRef.current?.({ reload: fullLoad });

      if (!skipDelays) await sleep(BETWEEN_STAGES_MS, signal);
      setStage('endgame');
      await ensureEndgameModesRef.current?.(['raid', 'dungeon'], {
        fullHistory: true,
        reload: fullLoad
      });

      if (!skipDelays) await sleep(BETWEEN_STAGES_MS, signal);
      setStage('pvp');
      await ensureEndgameModesRef.current?.(['pvp'], {
        fullHistory: fullLoad,
        reload: fullLoad
      });

      setStage('done');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
  }, [careerKey]);

  useEffect(() => {
    if (!careerKey || !enabled) {
      abortRef.current?.abort();
      pipelineKeyRef.current = '';
      setStage('idle');
      return;
    }

    if (pipelineKeyRef.current === careerKey) return;
    pipelineKeyRef.current = careerKey;
    setStage('idle');
    void runPipeline(false);

    return () => {
      abortRef.current?.abort();
    };
  }, [careerKey, enabled, runPipeline]);

  const loadAllNow = useCallback(() => {
    void runPipeline(true);
  }, [runPipeline]);

  const active = stage !== 'idle' && stage !== 'done';

  return { stage, active, loadAllNow };
}
