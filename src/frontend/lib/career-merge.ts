import type { CareerSummaryDto, EndgameDto } from './types';

export type EndgameMode = 'raid' | 'dungeon' | 'pvp';

export function mergeEndgameCareer(career: CareerSummaryDto, payload: EndgameDto | Record<string, unknown>, mode?: EndgameMode): CareerSummaryDto {
  const endgame = (payload as EndgameDto).endgame || payload;
  const loading: Record<string, boolean> =
    career.endgameLoading && typeof career.endgameLoading === 'object'
      ? { ...career.endgameLoading }
      : { raid: false, dungeon: false, pvp: false };

  if (mode) {
    loading[mode] = false;
  } else {
    for (const key of Object.keys(endgame as Record<string, unknown>)) {
      if (key === 'raid' || key === 'dungeon' || key === 'pvp') loading[key] = false;
    }
  }

  const statsPatch = (payload as EndgameDto).statsPatch;
  const stats = { ...(career.stats || {}) };
  if (statsPatch?.raid) stats.raid = statsPatch.raid;
  if (statsPatch?.dungeon) stats.dungeon = statsPatch.dungeon;

  return {
    ...career,
    endgameLoading: loading.raid || loading.dungeon || loading.pvp ? loading : false,
    endgame: { ...(career.endgame || {}), ...(endgame as Record<string, unknown>) },
    stats,
    cache: { ...(career.cache || {}), ...((payload as EndgameDto).cache || {}) }
  };
}
