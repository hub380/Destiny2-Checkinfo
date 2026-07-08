import { FormEvent, useCallback, useRef, useState } from 'react';
import type { EndgameMode } from '@frontend/lib/career-merge';
import { pushRecentQuery } from '@frontend/lib/recent-queries';
import { bungieNameSubmitHint, resolveBungieNameSubmit } from '@frontend/lib/player-search-submit';
import type { PlayerSearchItemDto } from '@frontend/lib/types';
import { useCareerQuery } from './useCareerQuery';
import { useCareerProgressiveLoad } from './useCareerProgressiveLoad';
import { useBungieNameSearchFlow } from './useBungieNameSearchFlow';
import { useUrlQuerySync } from './useUrlQueryParam';

type LoadStrategy = 'eager' | 'lazy' | 'none' | 'progressive';

type UseCareerSearchFlowOptions = {
  modes: EndgameMode[];
  includeDetails: boolean | 'lazy';
  loadEndgame?: LoadStrategy;
  loadingNotice?: string;
  recentScope?: string;
};

export function useCareerSearchFlow(options: UseCareerSearchFlowOptions) {
  const recentScope = options.recentScope || 'career';
  const autoProgressive = options.loadEndgame === 'progressive';
  const {
    career,
    loading,
    error,
    query: runCareerQuery,
    ensureDetails,
    ensureEndgameModes
  } = useCareerQuery({
    modes: options.modes,
    includeDetails: options.includeDetails,
    loadEndgame: autoProgressive
      ? 'lazy'
      : (options.loadEndgame === 'progressive' ? 'lazy' : options.loadEndgame) ?? (options.modes.length ? 'eager' : 'none')
  });
  const { stage: progressiveStage, loadAllNow } = useCareerProgressiveLoad({
    career,
    enabled: autoProgressive && Boolean(career),
    ensureDetails,
    ensureEndgameModes
  });
  const { query, setQuery, setValue, playerSearch } = useBungieNameSearchFlow();
  const [notice, setNotice] = useState('');
  const lastQueryRef = useRef('');

  const runNamedQuery = useCallback(
    async (rawName: string, writeUrl = true) => {
      const bungieName = rawName.trim();
      if (!bungieName) return { ok: false as const };
      lastQueryRef.current = bungieName;
      setValue(bungieName, { writeUrl });
      playerSearch.clearSuggestions();
      if (options.loadingNotice) setNotice(options.loadingNotice);
      const result = await runCareerQuery(bungieName);
      if (result.ok) pushRecentQuery(recentScope, bungieName);
      setNotice(result.ok ? '' : result.error || '查询失败');
      return result;
    },
    [options.loadingNotice, playerSearch, recentScope, runCareerQuery, setValue]
  );

  useUrlQuerySync('q', (value) => {
    setQuery(value);
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
    await runNamedQuery(player.bungieName, false);
  }

  function pickUsername(username: string) {
    setQuery(username);
    if (!username.includes('#')) {
      setNotice('小黑盒用户名可能不是棒鸡 ID，请补全 名称#数字代码 或从下拉选择玩家。');
      playerSearch.setOpen(false);
      return;
    }
    setNotice('');
    void runNamedQuery(username);
  }

  const retry = useCallback(() => {
    const value = lastQueryRef.current || query.trim();
    if (value) void runNamedQuery(value, false);
  }, [query, runNamedQuery]);

  const submitHint = bungieNameSubmitHint(query, playerSearch);
  const noticeMessage = error || notice || submitHint;
  const noticeError = Boolean(error) || Boolean(submitHint && !playerSearch.suggestions.length);

  return {
    query,
    setQuery,
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
    runNamedQuery,
    ensureDetails,
    ensureEndgameModes,
    retry,
    autoProgressive,
    progressiveStage,
    loadAllNow
  };
}
