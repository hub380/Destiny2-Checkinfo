import { getEndgame } from './api';
import { mergeEndgameCareer, type EndgameMode } from './career-merge';
import type { CareerSummaryDto } from './types';

export type EndgameBaseRequest = {
  membershipType: number;
  membershipId: string;
  characters: CareerSummaryDto['characters'];
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
  }
) {
  const errorMessage = options.errorMessage || '活动历史加载失败';
  await Promise.allSettled(
    modes.map(async (mode) => {
      try {
        const payload = await getEndgame({ ...baseRequest, mode });
        if (options.isCancelled()) return;
        options.onUpdate((current) => mergeEndgameCareer(current, payload, mode));
      } catch (err: unknown) {
        if (options.isCancelled()) return;
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

/** Sequential endgame fetch for a list of members (one batch request per member). */
export async function loadEndgameForMembersSequential<T>(
  members: T[],
  limit: number,
  buildRequest: (member: T) => Record<string, unknown> | null,
  options: {
    isCancelled: () => boolean;
    onMemberSuccess: (member: T, payload: Record<string, unknown>) => void;
    onMemberError: (member: T, message: string) => void;
    errorMessage?: string;
  }
) {
  const errorMessage = options.errorMessage || '高难活动数据加载失败';
  for (const member of members.slice(0, limit)) {
    const request = buildRequest(member);
    if (!request) continue;
    try {
      const payload = await getEndgame(request);
      if (options.isCancelled()) return;
      options.onMemberSuccess(member, payload as Record<string, unknown>);
    } catch (err: unknown) {
      if (options.isCancelled()) return;
      const message = err instanceof Error ? err.message : errorMessage;
      options.onMemberError(member, message);
    }
  }
}
