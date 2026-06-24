import { useEffect, useRef } from 'react';

/** Re-run handler when the user navigates with browser back/forward. */
export function useUrlPopstate(handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onPopstate = () => handlerRef.current();
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);
}
