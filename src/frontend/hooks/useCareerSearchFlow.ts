import { FormEvent, useCallback, useState } from 'react';
import type { EndgameMode } from '@frontend/lib/career-merge';
import { bungieNameSubmitHint, resolveBungieNameSubmit } from '@frontend/lib/player-search-submit';
import type { PlayerSearchItemDto } from '@frontend/lib/types';
import { useCareerQuery } from './useCareerQuery';
import { usePlayerSearch } from './usePlayerSearch';
import { useUrlQueryParam, useUrlQuerySync } from './useUrlQueryParam';

type UseCareerSearchFlowOptions = {
  modes: EndgameMode[];
  includeDetails: boolean;
  loadingNotice?: string;
};

export function useCareerSearchFlow(options: UseCareerSearchFlowOptions) {
  const { career, loading, error, query: runCareerQuery } = useCareerQuery({
    modes: options.modes,
    includeDetails: options.includeDetails
  });
  const { value: query, setValue } = useUrlQueryParam('q');
  const playerSearch = usePlayerSearch(query);
  const [notice, setNotice] = useState('');

  const runNamedQuery = useCallback(
    async (rawName: string, writeUrl = true) => {
      const bungieName = rawName.trim();
      if (!bungieName) return { ok: false as const };
      setValue(bungieName, { writeUrl });
      playerSearch.clearSuggestions();
      if (options.loadingNotice) setNotice(options.loadingNotice);
      const result = await runCareerQuery(bungieName);
      setNotice(result.ok ? '' : result.error || '查询失败');
      return result;
    },
    [options.loadingNotice, playerSearch, runCareerQuery, setValue]
  );

  useUrlQuerySync('q', (value) => {
    setValue(value, { writeUrl: false });
    if (value) void runNamedQuery(value, false);
    else setNotice('');
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await resolveBungieNameSubmit(query, playerSearch);
    if (result.status === 'ready') await runNamedQuery(result.bungieName);
  }

  async function selectPlayer(player: PlayerSearchItemDto) {
    if (!player.bungieName) return;
    setValue(player.bungieName, { writeUrl: true });
    await runNamedQuery(player.bungieName);
  }

  function pickUsername(username: string) {
    setValue(username, { writeUrl: false });
    if (!username.includes('#')) {
      setNotice('小黑盒用户名可能不是棒鸡 ID，请补全 名称#数字代码 或从下拉选择玩家。');
      playerSearch.setOpen(false);
      return;
    }
    setNotice('');
    void runNamedQuery(username);
  }

  const submitHint = bungieNameSubmitHint(query, playerSearch);
  const noticeMessage = error || notice || submitHint;
  const noticeError = Boolean(error) || Boolean(submitHint && !playerSearch.suggestions.length);

  return {
    query,
    setQuery: (value: string) => setValue(value, { writeUrl: false }),
    career,
    loading,
    error,
    notice,
    noticeMessage,
    noticeError,
    playerSearch,
    onSubmit,
    selectPlayer,
    pickUsername,
    runNamedQuery
  };
}
