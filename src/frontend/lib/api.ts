import type { CareerSummaryDto, EndgameDto, FireteamLookupDto, FireteamsResponseDto, GearSearchDto, GuideDetailDto, GuideIndexDto, JsonRecord, PlayerSearchDto } from './types';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }
  return payload as T;
}

export function getConfig() {
  return fetchJson<JsonRecord>('/api/config-public');
}

export function getHeyboxTeams() {
  return fetchJson<FireteamsResponseDto>('/api/heybox/teams');
}

/** @deprecated Use `getHeyboxTeams`. */
export function getFireteams() {
  return getHeyboxTeams();
}

export function getBungieFireteamLookup(body: JsonRecord) {
  return postJson<FireteamLookupDto>('/api/destiny/fireteam', body);
}

/** @deprecated Use `getBungieFireteamLookup`. */
export function getFireteamLookup(body: JsonRecord) {
  return getBungieFireteamLookup(body);
}

export function getCareerSummary(bungieName: string) {
  return postJson<CareerSummaryDto>('/api/destiny/summary', { bungieName });
}

export function searchPlayers(query: string) {
  return postJson<PlayerSearchDto>('/api/destiny/player-search', { query, limit: 30 });
}

export function getCareerDetails(body: JsonRecord) {
  return postJson<JsonRecord>('/api/destiny/details', body);
}

export function getEndgame(body: JsonRecord) {
  return postJson<EndgameDto>('/api/destiny/endgame', body);
}

export function searchGear(query: string) {
  return postJson<GearSearchDto>('/api/gear/search', { query, kind: 'all', limit: 80 });
}

export function getGearItem(hash: string) {
  return postJson<JsonRecord>('/api/gear/item', { hash });
}

export function getPerkWeapons(body: JsonRecord) {
  return postJson<JsonRecord>('/api/gear/perk-weapons', { ...body, limit: 80 });
}

export function getGuides() {
  return fetchJson<GuideIndexDto>('/api/guides');
}

export function getGuide(slug: string) {
  return fetchJson<GuideDetailDto>(`/api/guides/${encodeURIComponent(slug)}`);
}

function postJson<T>(url: string, body: JsonRecord) {
  return fetchJson<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}
