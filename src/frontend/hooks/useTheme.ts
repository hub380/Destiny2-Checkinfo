import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'd2-theme';

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* ignore */
  }
  return 'system';
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

export function initTheme() {
  applyTheme(readStored());
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => readStored());

  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }
  }, [preference]);

  const cycle = useCallback(() => {
    setPreference((current) => {
      const order: ThemePreference[] = ['system', 'light', 'dark'];
      const index = order.indexOf(current);
      return order[(index + 1) % order.length];
    });
  }, []);

  return { preference, setPreference, cycle };
}

export function themeLabel(preference: ThemePreference) {
  if (preference === 'light') return '浅色';
  if (preference === 'dark') return '深色';
  return '跟随系统';
}
