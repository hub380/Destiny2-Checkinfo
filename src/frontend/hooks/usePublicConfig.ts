import { useEffect, useState } from 'react';
import { getConfig } from '@frontend/lib/api';

export type PublicConfig = {
  hasBungieApiKey?: boolean;
  hasHeyboxSource?: boolean;
  refreshSeconds?: number;
};

export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getConfig()
      .then((payload) => {
        if (!cancelled) setConfig(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, error, ready: config !== null || error };
}
