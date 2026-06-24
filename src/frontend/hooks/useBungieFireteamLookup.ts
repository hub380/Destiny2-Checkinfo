import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getBungieFireteamLookup } from '@frontend/lib/api';
import { readUrlSearchParam, writeUrlSearchParam } from '@frontend/lib/url';
import { loadEndgameForMembersSequential } from '@frontend/lib/endgame-tasks';
import type { FireteamLookupDto, FireteamMemberLookupDto, PlayerSearchItemDto } from '@frontend/lib/types';
import {
  COPY_BUNGIE_NAME_NO_MATCH,
  COPY_BUNGIE_NAME_PICK,
  COPY_BUNGIE_NAME_REQUIRED,
  COPY_BUNGIE_NAME_REQUIRED_PICK
} from '@frontend/lib/copy';
import { resolveBungieNameSubmit } from '@frontend/lib/player-search-submit';
import { usePlayerSearch } from './usePlayerSearch';
import { useUrlQuerySync } from './useUrlQueryParam';

function memberKey(member: FireteamMemberLookupDto) {
  return `${member.account?.membershipType || member.membershipType || ''}:${member.account?.membershipId || member.membershipId || ''}`;
}

function mergeMemberEndgame(current: FireteamLookupDto | null, target: FireteamMemberLookupDto, payload: Record<string, unknown>): FireteamLookupDto | null {
  if (!current) return current;
  return {
    ...current,
    members: (current.members || []).map((member) => {
      if (memberKey(member) !== memberKey(target)) return member;
      const stats = { ...(member.stats || {}) };
      const statsPatch = payload.statsPatch as Record<string, unknown> | undefined;
      if (statsPatch?.raid) stats.raid = statsPatch.raid;
      if (statsPatch?.dungeon) stats.dungeon = statsPatch.dungeon;
      return {
        ...member,
        endgameLoading: false,
        endgame: { ...(member.endgame || {}), ...(payload.endgame as Record<string, unknown> || {}) },
        stats,
        cache: { ...(member.cache || {}), ...((payload.cache as Record<string, unknown>) || {}) }
      };
    })
  };
}

function markMemberEndgameDone(current: FireteamLookupDto | null, target: FireteamMemberLookupDto, warning: string): FireteamLookupDto | null {
  if (!current) return current;
  return {
    ...current,
    members: (current.members || []).map((member) =>
      memberKey(member) === memberKey(target)
        ? { ...member, endgameLoading: false, warnings: [warning, ...(member.warnings || [])] }
        : member
    )
  };
}

function playerRequest(player: PlayerSearchItemDto) {
  return {
    bungieName: player.bungieName,
    membershipType: player.membershipType,
    membershipId: player.membershipId
  };
}

export function useBungieFireteamLookup() {
  const [query, setQuery] = useState(() => readUrlSearchParam('q') || '');
  const [lookup, setLookup] = useState<FireteamLookupDto | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchItemDto | null>(null);
  const playerSearch = usePlayerSearch(query);
  const queryRef = useRef(query);
  const playerSearchRef = useRef(playerSearch);
  const inflightKeyRef = useRef<string | null>(null);
  queryRef.current = query;
  playerSearchRef.current = playerSearch;

  const runQuery = useCallback(async (body: Record<string, unknown>) => {
    const bungieName = String(body.bungieName || queryRef.current || '').trim();
    if (!bungieName && !body.membershipId) {
      setNotice(COPY_BUNGIE_NAME_REQUIRED);
      setError(true);
      return;
    }

    const requestKey = body.membershipId
      ? `${body.membershipType || ''}:${body.membershipId}`
      : bungieName;
    if (inflightKeyRef.current === requestKey) return;

    inflightKeyRef.current = requestKey;
    setLoading(true);
    setLookup(null);
    setNotice('正在查询当前队伍和成员生涯数据。');
    setError(false);
    playerSearchRef.current.clearSuggestions();
    if (readUrlSearchParam('q') !== bungieName) writeUrlSearchParam('q', bungieName);
    try {
      const payload = await getBungieFireteamLookup({
        ...body,
        bungieName,
        modes: ['raid', 'dungeon']
      });
      setLookup(payload);
      setNotice(payload.message || '查询完成。');
      setError(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '队伍查询失败';
      setNotice(message);
      setError(true);
    } finally {
      if (inflightKeyRef.current === requestKey) inflightKeyRef.current = null;
      setLoading(false);
    }
  }, []);

  useUrlQuerySync('q', (value) => {
    setQuery(value);
    if (value) void runQuery({ bungieName: value });
    else {
      inflightKeyRef.current = null;
      setLookup(null);
      setNotice('');
      setError(false);
    }
  });

  useEffect(() => {
    if (!lookup?.updatedAt) return;
    const members = (lookup.members || []).filter(
      (member) => !member.error && member.account?.membershipType && member.account?.membershipId && member.characters?.length
    );
    if (!members.length) return;

    let cancelled = false;
    setLookup((current) =>
      current
        ? {
            ...current,
            members: (current.members || []).map((member) =>
              members.some((target) => memberKey(target) === memberKey(member))
                ? { ...member, endgameLoading: true }
                : member
            )
          }
        : current
    );

    const load = async () => {
      await loadEndgameForMembersSequential(
        members,
        6,
        (member) =>
          member.account?.membershipType && member.account?.membershipId && member.characters?.length
            ? {
                membershipType: member.account.membershipType,
                membershipId: member.account.membershipId,
                characters: member.characters,
                modes: ['raid', 'dungeon']
              }
            : null,
        {
          isCancelled: () => cancelled,
          onMemberSuccess: (member, payload) => {
            setLookup((current) => mergeMemberEndgame(current, member, payload));
          },
          onMemberError: (member, message) => {
            setLookup((current) => markMemberEndgameDone(current, member, message));
          }
        }
      );
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [lookup?.updatedAt]);

  function updateQuery(value: string) {
    setQuery(value);
    if (selectedPlayer?.bungieName !== value) setSelectedPlayer(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setNotice(COPY_BUNGIE_NAME_REQUIRED_PICK);
      setError(true);
      return;
    }
    if (selectedPlayer?.bungieName === value) {
      await runQuery(playerRequest(selectedPlayer));
      return;
    }
    const resolved = await resolveBungieNameSubmit(value, playerSearch);
    if (resolved.status === 'ready') {
      await runQuery({ bungieName: resolved.bungieName });
      return;
    }
    if (resolved.status === 'needs_pick') {
      setNotice(COPY_BUNGIE_NAME_PICK);
      setError(false);
      return;
    }
    if (resolved.status === 'no_match') {
      setNotice(COPY_BUNGIE_NAME_NO_MATCH);
      setError(true);
    }
  }

  async function selectPlayer(player: PlayerSearchItemDto) {
    setSelectedPlayer(player);
    setQuery(player.bungieName);
    playerSearch.clearSuggestions();
    await runQuery(playerRequest(player));
  }

  return {
    query,
    lookup,
    notice,
    error,
    loading,
    playerSearch,
    updateQuery,
    onSubmit,
    selectPlayer
  };
}
