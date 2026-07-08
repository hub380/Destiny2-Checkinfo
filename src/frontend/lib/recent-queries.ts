const MAX_RECENT = 5;

function storageKey(scope: string) {
  return `d2-recent-${scope}`;
}

export function readRecentQueries(scope: string, limit = MAX_RECENT): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === 'string' && item.trim()).slice(0, limit);
  } catch {
    return [];
  }
}

export function pushRecentQuery(scope: string, value: string, limit = MAX_RECENT) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecentQueries(scope, limit).filter((item) => item !== trimmed)].slice(0, limit);
    window.localStorage.setItem(storageKey(scope), JSON.stringify(next));
  } catch {
    // Ignore quota / unavailable storage (SSR, restricted jsdom).
  }
}
