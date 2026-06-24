import { useEffect, useRef, useState } from 'react';
import { readUrlSearchParam } from '@frontend/lib/url';

/** Read a URL search param once on mount and run an action when present. */
export function useMountUrlParam(param: string, onValue: (value: string) => void) {
  const [bootValue] = useState(() => readUrlSearchParam(param));
  const onValueRef = useRef(onValue);
  onValueRef.current = onValue;

  useEffect(() => {
    if (bootValue) onValueRef.current(bootValue);
  }, [bootValue]);
}
