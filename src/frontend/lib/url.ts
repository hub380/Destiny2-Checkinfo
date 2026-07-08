/** Read a query param from the current page URL. */
export function readUrlSearchParam(param: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(param);
  return value || undefined;
}

function buildPath(url: URL) {
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
}

/** Update query params without navigation. */
export function writeUrlSearchParam(param: string, value: string | null | undefined) {
  syncUrlParams({ [param]: value });
}

/** Batch-update query params (`replaceState` by default). */
export function syncUrlParams(
  updates: Record<string, string | null | undefined>,
  mode: 'replace' | 'push' = 'replace'
) {
  const url = new URL(window.location.href);
  for (const [param, value] of Object.entries(updates)) {
    const trimmed = value?.trim();
    if (trimmed) url.searchParams.set(param, trimmed);
    else url.searchParams.delete(param);
  }
  const next = buildPath(url);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === next) return;
  if (mode === 'push') window.history.pushState(null, '', next);
  else window.history.replaceState(null, '', next);
}
