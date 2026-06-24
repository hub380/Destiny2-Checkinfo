import { useEffect, useMemo, useState } from 'react';

/** Slice long lists for DOM/memory; reset when source identity changes. */
export function useWindowedSlice<T>(items: T[], pageSize = 48) {
  const [limit, setLimit] = useState(pageSize);
  const signature = items.length;

  useEffect(() => {
    setLimit(pageSize);
  }, [signature, pageSize]);

  const visible = useMemo(() => items.slice(0, limit), [items, limit]);
  const hasMore = items.length > visible.length;

  return {
    visible,
    hasMore,
    showMore: () => setLimit((current) => Math.min(current + pageSize, items.length))
  };
}
