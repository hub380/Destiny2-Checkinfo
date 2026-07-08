import { useEffect, useRef } from 'react';

type AbortScope = 'default' | 'details' | 'endgame';

/** Track in-flight requests and expose scoped AbortSignals. */
export function useAbortableRequest() {
  const controllersRef = useRef<Partial<Record<AbortScope, AbortController>>>({});

  useEffect(
    () => () => {
      Object.values(controllersRef.current).forEach((controller) => controller?.abort());
    },
    []
  );

  function begin(scope: AbortScope = 'default') {
    controllersRef.current[scope]?.abort();
    const controller = new AbortController();
    controllersRef.current[scope] = controller;
    return controller.signal;
  }

  function abort(scope?: AbortScope) {
    if (scope) {
      controllersRef.current[scope]?.abort();
      delete controllersRef.current[scope];
      return;
    }
    Object.values(controllersRef.current).forEach((controller) => controller?.abort());
    controllersRef.current = {};
  }

  return { begin, abort };
}
