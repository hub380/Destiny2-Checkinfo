import { useEffect, useState } from 'react';

export function readUrlSearchParam(param: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(param);
  return value || undefined;
}

/** Read a URL search param once on mount and run an action when present. */
export function useMountUrlParam(param: string, onValue: (value: string) => void) {
  const [bootValue] = useState(() => readUrlSearchParam(param));

  useEffect(() => {
    if (bootValue) onValue(bootValue);
  }, [bootValue, onValue]);
}
