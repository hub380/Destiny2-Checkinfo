import type { JsonRecord } from './types';
import { dedupeEndgameRequest } from './endgame-request-cache';

type ApiRequestOptions = RequestInit & {
  signal?: AbortSignal;
};

export async function fetchJson<T>(url: string, options?: ApiRequestOptions): Promise<T> {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }
  return payload as T;
}

function postJson<T>(url: string, body: JsonRecord, signal?: AbortSignal) {
  return fetchJson<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
}

export function getConfig(signal?: AbortSignal) {
  return fetchJson<JsonRecord>('/api/config-public', { signal });
}

export function getHeyboxTeams(signal?: AbortSignal) {
  return fetchJson<import('./types').FireteamsResponseDto>('/api/heybox/teams', { signal });
}

export function getBungieFireteamLookup(body: JsonRecord, signal?: AbortSignal) {
  return postJson<import('./types').FireteamLookupDto>('/api/destiny/fireteam', body, signal);
}

export function getCareerSummary(bungieName: string, signal?: AbortSignal) {
  return postJson<import('./types').CareerSummaryDto>('/api/destiny/summary', { bungieName }, signal);
}

export function searchPlayers(query: string, signal?: AbortSignal) {
  return postJson<import('./types').PlayerSearchDto>('/api/destiny/player-search', { query, limit: 30 }, signal);
}

export function getCareerDetails(body: JsonRecord, signal?: AbortSignal) {
  return postJson<JsonRecord>('/api/destiny/details', body, signal);
}

export function getEndgame(body: JsonRecord, signal?: AbortSignal) {
  return dedupeEndgameRequest(body, (payload) =>
    postJson<import('./types').EndgameDto>('/api/destiny/endgame', payload, signal)
  );
}

export function searchGear(query: string, kind = 'all', signal?: AbortSignal) {
  return postJson<import('./types').GearSearchDto>('/api/gear/search', { query, kind, limit: 80 }, signal);
}

export function getGearItem(hash: string, signal?: AbortSignal) {
  return postJson<JsonRecord>('/api/gear/item', { hash }, signal);
}

export function getPerkWeapons(body: JsonRecord, signal?: AbortSignal) {
  return postJson<JsonRecord>('/api/gear/perk-weapons', { ...body, limit: body.limit ?? 24, offset: body.offset ?? 0 }, signal);
}

export function warmGearIndex(signal?: AbortSignal) {
  return fetchJson<{ ok: boolean; warmedAt?: string }>('/api/gear/warm', { signal });
}

export function getGuides(signal?: AbortSignal) {
  return fetchJson<import('./types').GuideIndexDto>('/api/guides', { signal });
}

export function getGuide(slug: string, signal?: AbortSignal) {
  return fetchJson<import('./types').GuideDetailDto>(`/api/guides/${encodeURIComponent(slug)}`, { signal });
}
