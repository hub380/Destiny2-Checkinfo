import { useEffect, useRef, useState } from 'react';
import type { FireteamLookupDto } from '@frontend/lib/types';

const INITIAL_DELAY_MS = 320;

function lookupKey(lookup: FireteamLookupDto | null) {
  if (!lookup) return '';
  const name = String(lookup.bungieName || lookup.queriedName || '').trim();
  if (name) return name;
  const member = lookup.members?.[0];
  if (member?.account?.membershipId) {
    return `${member.account.membershipType || ''}:${member.account.membershipId}`;
  }
  return '';
}

function needsDetailedLoad(lookup: FireteamLookupDto | null) {
  if (!lookup?.members?.length) return false;
  return lookup.members.some(
    (member) =>
      !member.error &&
      member.account?.membershipId &&
      member.characters?.length &&
      !member.endgameDetailed
  );
}

type UseFireteamProgressiveLoadOptions = {
  lookup: FireteamLookupDto | null;
  enabled?: boolean;
  loadDetailed?: (options?: { fullHistory?: boolean }) => void | Promise<void>;
};

export function useFireteamProgressiveLoad({
  lookup,
  enabled = true,
  loadDetailed
}: UseFireteamProgressiveLoadOptions) {
  const pipelineKeyRef = useRef('');
  const loadRef = useRef(loadDetailed);
  const enabledRef = useRef(enabled);
  const [scheduled, setScheduled] = useState(false);

  loadRef.current = loadDetailed;
  enabledRef.current = enabled;

  const key = lookupKey(lookup);

  useEffect(() => {
    if (!key || !enabledRef.current || !needsDetailedLoad(lookup)) {
      if (!key) pipelineKeyRef.current = '';
      setScheduled(false);
      return;
    }
    if (pipelineKeyRef.current === key) return;
    pipelineKeyRef.current = key;
    setScheduled(true);

    const timer = window.setTimeout(() => {
      setScheduled(false);
      void loadRef.current?.({ fullHistory: false });
    }, INITIAL_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      setScheduled(false);
    };
  }, [key, lookup]);

  return { scheduled };
}
