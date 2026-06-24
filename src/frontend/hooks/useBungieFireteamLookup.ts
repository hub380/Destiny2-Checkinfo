import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getBungieFireteamLookup, getEndgame } from '@frontend/lib/api';
import { writeUrlSearchParam, readUrlSearchParam } from '@frontend/lib/url';
import type { FireteamLookupDto, FireteamMemberLookupDto, PlayerSearchItemDto } from '@frontend/lib/types';
import { useMountUrlParam } from './useMountUrlParam';
import { usePlayerSearch } from './usePlayerSearch';

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
  const [notice, setNotice] = useState('输入玩家棒鸡 ID，查询该玩家当前公开队伍。');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchItemDto | null>(null);
  const playerSearch = usePlayerSearch(query);

  const runQuery = useCallback(async (body: Record<string, unknown>) => {
    const bungieName = String(body.bungieName || query || '').trim();
    if (!bungieName && !body.membershipId) {
      setNotice('请输入棒鸡名称，格式为 名称#数字代码。');
      setError(true);
      return;
    }
    setLoading(true);
    setLookup(null);
    setNotice('正在查询当前队伍和成员生涯数据。');
    setError(false);
    playerSearch.clearSuggestions();
    writeUrlSearchParam('q', bungieName);
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
      setLoading(false);
    }
  }, [query, playerSearch]);

  useMountUrlParam('q', useCallback((value: string) => {
    setQuery(value);
    void runQuery({ bungieName: value });
  }, [runQuery]));

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
      for (const member of members.slice(0, 6)) {
        try {
          const payload = await getEndgame({
            membershipType: member.account?.membershipType,
            membershipId: member.account?.membershipId,
            characters: member.characters,
            modes: ['raid', 'dungeon']
          });
          if (cancelled) return;
          setLookup((current) => mergeMemberEndgame(current, member, payload as Record<string, unknown>));
        } catch (err: unknown) {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : '高难活动数据加载失败';
          setLookup((current) => markMemberEndgameDone(current, member, message));
        }
      }
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
      setNotice('请输入棒鸡名称，格式为 名称#数字代码，或先输入前缀后选择玩家。');
      setError(true);
      return;
    }
    if (selectedPlayer?.bungieName === value) {
      await runQuery(playerRequest(selectedPlayer));
      return;
    }
    if (!value.includes('#')) {
      const items = await playerSearch.refreshSuggestions(value);
      playerSearch.setOpen(true);
      setNotice(items.length ? '请选择一个完整的棒鸡 ID 后查询当前队伍。' : '没有匹配的棒鸡玩家。');
      setError(!items.length);
      return;
    }
    await runQuery({ bungieName: value });
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
