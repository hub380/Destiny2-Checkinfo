import { useCallback, useEffect, useRef, useState } from 'react';
import { readUrlSearchParam, writeUrlSearchParam } from '@frontend/lib';
import { useUrlPopstate } from './useUrlPopstate';

type UrlQuerySource = 'mount' | 'popstate' | 'user';

/** Read multiple URL search params at once. */
export function readUrlParams(params: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of params) values[param] = readUrlSearchParam(param) || '';
  return values;
}

/** Sync a single URL search param with React state and browser navigation. */
export function useUrlQueryParam(param: string) {
  const [value, setValueState] = useState(() => readUrlSearchParam(param) || '');

  const setValue = useCallback(
    (next: string, options?: { writeUrl?: boolean }) => {
      const trimmed = next.trim();
      setValueState(trimmed);
      if (options?.writeUrl && readUrlSearchParam(param) !== trimmed) {
        writeUrlSearchParam(param, trimmed || null);
      }
    },
    [param]
  );

  return { value, setValue, setValueState };
}

/** Bootstrap + popstate handler for a single query param. */
export function useUrlQuerySync(param: string, handler: (value: string, source: UrlQuerySource) => void) {
  const handlerRef = useRef(handler);
  const bootedRef = useRef(false);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const value = readUrlSearchParam(param) || '';
    if (value) handlerRef.current(value, 'mount');
  }, [param]);

  useUrlPopstate(() => {
    handlerRef.current(readUrlSearchParam(param) || '', 'popstate');
  });
}

type UrlParamsSyncOptions = {
  /** Skip the initial mount callback (e.g. when another loader handles first paint). */
  skipMount?: boolean;
};

/** Bootstrap + popstate handler for multi-param URL flows. */
export function useUrlParamsSync(
  params: readonly string[],
  handler: (values: Record<string, string>, source: UrlQuerySource) => void,
  options?: UrlParamsSyncOptions
) {
  const handlerRef = useRef(handler);
  const bootedRef = useRef(false);
  const paramsRef = useRef(params);
  const paramsKey = params.join('\0');

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    paramsRef.current = params;
  }, [paramsKey, params]);

  useEffect(() => {
    if (options?.skipMount) return;
    if (bootedRef.current) return;
    bootedRef.current = true;
    handlerRef.current(readUrlParams(paramsRef.current), 'mount');
  }, [paramsKey, options?.skipMount]);

  useUrlPopstate(() => {
    handlerRef.current(readUrlParams(paramsRef.current), 'popstate');
  });
}
