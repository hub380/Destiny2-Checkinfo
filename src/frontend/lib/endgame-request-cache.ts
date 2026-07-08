import type { EndgameDto, JsonRecord } from './types';

type CacheEntry = {
  promise: Promise<EndgameDto>;
};

const inflight = new Map<string, CacheEntry>();

function cacheKey(body: JsonRecord) {
  return [
    body.membershipType,
    body.membershipId,
    body.mode,
    body.fullHistory === false ? 'summary' : 'full'
  ].join(':');
}

export function dedupeEndgameRequest(
  body: JsonRecord,
  request: (payload: JsonRecord) => Promise<EndgameDto>
) {
  const key = cacheKey(body);
  const existing = inflight.get(key);
  if (existing) return existing.promise;

  const promise = request(body).finally(() => {
    if (inflight.get(key)?.promise === promise) inflight.delete(key);
  });
  inflight.set(key, { promise });
  return promise;
}

export function clearEndgameRequestCache() {
  inflight.clear();
}
