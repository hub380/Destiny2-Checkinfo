import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { getBungieFireteamLookup } from '@frontend/lib/api';

import { loadEndgameForMembersConcurrent } from '@frontend/lib/endgame-tasks';

import { pushRecentQuery } from '@frontend/lib/recent-queries';

import type { FireteamLookupDto, FireteamMemberLookupDto, PlayerSearchItemDto } from '@frontend/lib/types';

import {

  COPY_BUNGIE_NAME_NO_MATCH,

  COPY_BUNGIE_NAME_PICK,

  COPY_BUNGIE_NAME_REQUIRED,

  COPY_BUNGIE_NAME_REQUIRED_PICK,

  COPY_FIRETEAM_DETAILED_LOADING

} from '@frontend/lib/copy';

import { resolveBungieNameSubmit } from '@frontend/lib/player-search-submit';

import { useBungieNameSearchFlow } from './useBungieNameSearchFlow';

import { useUrlQuerySync } from './useUrlQueryParam';

import { useAbortableRequest } from './useAbortableRequest';

import { useFireteamProgressiveLoad } from './useFireteamProgressiveLoad';



const FIRETEAM_ENDGAME_CONCURRENCY = 3;

const RECENT_SCOPE = 'fireteam';



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

        endgameDetailed: true,

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



function eligibleMembers(lookup: FireteamLookupDto | null) {

  return (lookup?.members || []).filter(

    (member) => !member.error && member.account?.membershipType && member.account?.membershipId && member.characters?.length

  );

}



export function useBungieFireteamLookup() {

  const { query, setQuery, setValue, playerSearch } = useBungieNameSearchFlow();

  const [lookup, setLookup] = useState<FireteamLookupDto | null>(null);

  const [notice, setNotice] = useState('');

  const [error, setError] = useState(false);

  const [loading, setLoading] = useState(false);

  const [detailedLoading, setDetailedLoading] = useState(false);

  const [endgameProgress, setEndgameProgress] = useState({ loaded: 0, total: 0 });

  const [endgameDone, setEndgameDone] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchItemDto | null>(null);

  const selectedPlayerRef = useRef(selectedPlayer);

  const inflightKeyRef = useRef<string | null>(null);

  const lastRequestRef = useRef<Record<string, unknown> | null>(null);

  const detailedRunRef = useRef(0);

  const { begin, abort } = useAbortableRequest();



  useEffect(() => {

    selectedPlayerRef.current = selectedPlayer;

  }, [selectedPlayer]);



  const runQuery = useCallback(async (body: Record<string, unknown>, writeUrl = true) => {

    const bungieName = String(body.bungieName || query || '').trim();

    if (!bungieName && !body.membershipId) {

      setNotice(COPY_BUNGIE_NAME_REQUIRED);

      setError(true);

      return;

    }



    const requestKey = body.membershipId

      ? `${body.membershipType || ''}:${body.membershipId}`

      : bungieName;

    if (inflightKeyRef.current === requestKey) return;



    lastRequestRef.current = body;

    inflightKeyRef.current = requestKey;

    const signal = begin();

    setLoading(true);

    setLookup(null);

    setDetailedLoading(false);

    setEndgameProgress({ loaded: 0, total: 0 });

    setEndgameDone(false);

    setNotice('正在查询当前队伍和成员公开资料。');

    setError(false);

    playerSearch.clearSuggestions();

    if (bungieName) setValue(bungieName, { writeUrl });

    try {

      const payload = await getBungieFireteamLookup({

        ...body,

        bungieName,

        modes: ['raid', 'dungeon']

      }, signal);

      setLookup(payload);

      if (bungieName) pushRecentQuery(RECENT_SCOPE, bungieName);

      setNotice(payload.message || '查询完成。Raid / 地牢概要已显示，详细历史将自动加载。');

      setError(false);

    } catch (err: unknown) {

      if (err instanceof DOMException && err.name === 'AbortError') return;

      const message = err instanceof Error ? err.message : '队伍查询失败';

      setNotice(message);

      setError(true);

    } finally {

      if (inflightKeyRef.current === requestKey) inflightKeyRef.current = null;

      setLoading(false);

    }

  }, [begin, playerSearch, query, setValue]);



  const loadDetailedEndgame = useCallback(async (options?: { fullHistory?: boolean }) => {

    const members = eligibleMembers(lookup).filter((member) => !member.endgameDetailed);

    if (!members.length) {

      setNotice('成员详细终局数据已加载，或没有可加载的公开成员。');

      setEndgameDone(true);

      return;

    }



    const runId = ++detailedRunRef.current;

    const fullHistory = options?.fullHistory !== false;

    setDetailedLoading(true);

    setEndgameDone(false);

    setEndgameProgress({ loaded: 0, total: members.length });

    setNotice(COPY_FIRETEAM_DETAILED_LOADING);

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



    const signal = begin();

    const isStale = () => detailedRunRef.current !== runId || signal.aborted;

    const bumpProgress = () => {

      if (isStale()) return;

      setEndgameProgress((current) => ({ ...current, loaded: Math.min(current.total, current.loaded + 1) }));

    };



    try {

      await loadEndgameForMembersConcurrent(

        members,

        6,

        FIRETEAM_ENDGAME_CONCURRENCY,

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

          isCancelled: isStale,

          onMemberSuccess: (member, payload) => {

            bumpProgress();

            if (isStale()) return;

            setLookup((current) => mergeMemberEndgame(current, member, payload));

          },

          onMemberError: (member, message) => {

            bumpProgress();

            if (isStale()) return;

            setLookup((current) => markMemberEndgameDone(current, member, message));

          },

          request: { fullHistory, signal }

        }

      );

      if (!isStale()) {

        setNotice('成员详细终局数据加载完成。');

        setEndgameDone(true);

      }

    } catch (err: unknown) {

      if (!isStale() && !(err instanceof DOMException && err.name === 'AbortError')) {

        setNotice(err instanceof Error ? err.message : '详细终局数据加载失败');

        setError(true);

      }

    } finally {

      if (!isStale()) setDetailedLoading(false);

    }

  }, [begin, lookup]);



  const { scheduled: progressiveScheduled } = useFireteamProgressiveLoad({

    lookup,

    enabled: Boolean(lookup) && !loading,

    loadDetailed: loadDetailedEndgame

  });



  const retry = useCallback(() => {

    const body = lastRequestRef.current;

    if (!body) return;

    void runQuery(body, false);

  }, [runQuery]);



  useUrlQuerySync('q', (value) => {

    abort();

    detailedRunRef.current += 1;

    setValue(value, { writeUrl: false });

    if (selectedPlayerRef.current?.bungieName !== value) setSelectedPlayer(null);

    if (value) void runQuery({ bungieName: value }, false);

    else {

      inflightKeyRef.current = null;

      setLookup(null);

      setNotice('');

      setError(false);

      setEndgameProgress({ loaded: 0, total: 0 });

      setEndgameDone(false);

    }

  });



  function updateQuery(value: string) {

    setQuery(value);

    if (selectedPlayerRef.current?.bungieName !== value) setSelectedPlayer(null);

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

      await runQuery(playerRequest(selectedPlayer), false);

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

    if (player.bungieName) setValue(player.bungieName, { writeUrl: true });

    playerSearch.clearSuggestions();

    await runQuery(playerRequest(player), false);

  }



  return {

    query,

    lookup,

    notice,

    error,

    loading,

    detailedLoading,

    endgameProgress,

    endgameDone,

    progressiveScheduled,

    playerSearch,

    updateQuery,

    onSubmit,

    selectPlayer,

    loadDetailedEndgame,

    retry

  };

}

