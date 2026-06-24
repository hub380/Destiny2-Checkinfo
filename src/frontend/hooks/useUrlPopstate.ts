import { useEffect } from 'react';

/** Re-run handler when the user navigates with browser back/forward. */
export function useUrlPopstate(handler: () => void) {
  useEffect(() => {
    const onPopstate = () => handler();
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, [handler]);
}
