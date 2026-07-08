import { useCallback } from 'react';
import { usePlayerSearch } from './usePlayerSearch';
import { useUrlQueryParam } from './useUrlQueryParam';

/** Shared Bungie name query state: URL param + player autocomplete. */
export function useBungieNameSearchFlow() {
  const { value: query, setValue } = useUrlQueryParam('q');
  const playerSearch = usePlayerSearch(query);

  const setQuery = useCallback(
    (value: string) => {
      setValue(value, { writeUrl: false });
    },
    [setValue]
  );

  return { query, setQuery, setValue, playerSearch };
}
