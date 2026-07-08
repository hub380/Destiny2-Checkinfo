import { getEndgame } from './api';
import { mergeEndgameCareer, type EndgameMode } from './career-merge';
import type { CareerSummaryDto } from './types';

export type EndgameBaseRequest = {
  membershipType: number;
  membershipId: string;
  characters: CareerSummaryDto['characters'];
};

type EndgameRequestOptions = {
  fullHistory?: boolean;
  signal?: AbortSignal;
};

/** Fetch endgame modes in parallel and apply career merges. */
export async function loadEndgameModesProgressive(
  baseRequest: EndgameBaseRequest,
  modes: EndgameMode[],
  options: {
    isCancelled: () => boolean;
    onUpdate: (updater: (current: CareerSummaryDto) => CareerSummaryDto) => void;
    onError?: (mode: EndgameMode, message: string) => void;
    errorMessage?: string;
    request?: EndgameRequestOptions;
  }
) {
  const errorMessage = options.errorMessage || '活动历史加载失败';
  const fullHistory = options.request?.fullHistory !== false;
  const signal = options.request?.signal;
  await Promise.allSettled(
    modes.map(async (mode) => {
      try {
        const payload = await getEndgame({ ...baseRequest, mode, fullHistory }, signal);
        if (options.isCancelled()) return;
        options.onUpdate((current) => mergeEndgameCareer(current, payload, mode));
      } catch (err: unknown) {
        if (options.isCancelled() || (err instanceof DOMException && err.name === 'AbortError')) return;
        const message = err instanceof Error ? err.message : errorMessage;
        if (options.onError) {
          options.onError(mode, message);
          return;
        }
        options.onUpdate((current) => ({
          ...current,
          endgameLoading: {
            ...(current.endgameLoading && typeof current.endgameLoading === 'object' ? current.endgameLoading : {}),
            [mode]: false
          },
          endgameErrors: { ...(current.endgameErrors || {}), [mode]: message }
        }));
      }
    })
  );
}

/** Concurrent endgame fetch for a list of members with a concurrency limit. */
export async function loadEndgameForMembersConcurrent<T>(
  members: T[],
  limit: number,
  concurrency: number,
  buildRequest: (member: T) => Record<string, unknown> | null,
  options: {
    isCancelled: () => boolean;
    onMemberSuccess: (member: T, payload: Record<string, unknown>) => void;
    onMemberError: (member: T, message: string) => void;
    errorMessage?: string;
    request?: EndgameRequestOptions;
  }
) {
  const errorMessage = options.errorMessage || '高难活动数据加载失败';
  const queue = members.slice(0, limit);
  let index = 0;
  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), queue.length || 1) }, async () => {
    while (index < queue.length) {
      const currentIndex = index;
      index += 1;
      const member = queue[currentIndex];
      const request = buildRequest(member);
      if (!request) continue;
      try {
        const payload = await getEndgame(
          {
            ...request,
            fullHistory: options.request?.fullHistory !== false
          },
          options.request?.signal
        );
        if (options.isCancelled()) return;
        options.onMemberSuccess(member, payload as Record<string, unknown>);
      } catch (err: unknown) {
        if (options.isCancelled() || (err instanceof DOMException && err.name === 'AbortError')) return;
        const message = err instanceof Error ? err.message : errorMessage;
        options.onMemberError(member, message);
      }
    }
  });
  await Promise.all(workers);
}
