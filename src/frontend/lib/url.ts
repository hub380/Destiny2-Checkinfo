/** Read a query param from the current page URL. */
export function readUrlSearchParam(param: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(param);
  return value || undefined;
}

/** Update a query param without navigation (shareable / bookmarkable URLs). */
export function writeUrlSearchParam(param: string, value: string | null | undefined) {
  const url = new URL(window.location.href);
  const trimmed = value?.trim();
  if (trimmed) url.searchParams.set(param, trimmed);
  else url.searchParams.delete(param);
  const qs = url.searchParams.toString();
  const next = `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current !== next) window.history.replaceState(null, '', next);
}
