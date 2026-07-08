import { useCallback, useState } from 'react';
import { pushRecentQuery, readRecentQueries } from '@frontend/lib/recent-queries';

export function useRecentQueries(scope: string) {
  const [recent, setRecent] = useState(() => readRecentQueries(scope));

  const refresh = useCallback(() => {
    setRecent(readRecentQueries(scope));
  }, [scope]);

  const remember = useCallback(
    (value: string) => {
      pushRecentQuery(scope, value);
      refresh();
    },
    [refresh, scope]
  );

  return { recent, remember, refresh };
}
