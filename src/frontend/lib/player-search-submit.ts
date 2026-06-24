import type { PlayerSearchState } from '../hooks/usePlayerSearch';
import {
  COPY_BUNGIE_NAME_NO_MATCH,
  COPY_BUNGIE_NAME_PICK
} from './copy';

export type BungieNameSubmitResult =
  | { status: 'ready'; bungieName: string }
  | { status: 'empty' }
  | { status: 'needs_pick'; count: number }
  | { status: 'no_match' };

type PlayerSearchActions = Pick<PlayerSearchState, 'refreshSuggestions' | 'setOpen' | 'suggestions' | 'notice'>;

/** Resolve a search-box value into a full bungie name or a pick-list state. */
export async function resolveBungieNameSubmit(
  value: string,
  playerSearch: Pick<PlayerSearchState, 'refreshSuggestions' | 'setOpen'>
): Promise<BungieNameSubmitResult> {
  const trimmed = value.trim();
  if (!trimmed) return { status: 'empty' };
  if (trimmed.includes('#')) return { status: 'ready', bungieName: trimmed };
  const items = await playerSearch.refreshSuggestions(trimmed);
  playerSearch.setOpen(true);
  if (!items.length) return { status: 'no_match' };
  return { status: 'needs_pick', count: items.length };
}

export function bungieNameSubmitHint(query: string, playerSearch: PlayerSearchActions, pickMessage = COPY_BUNGIE_NAME_PICK) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.includes('#')) return '';
  if (playerSearch.suggestions.length) return pickMessage;
  return playerSearch.notice || COPY_BUNGIE_NAME_NO_MATCH;
}
