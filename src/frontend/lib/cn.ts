import type { CSSProperties } from 'react';
import motion from '../styles/motion.module.css';
import uiStyles from '../styles/ui.module.css';

export type CssModule = Record<string, string>;

export const uiClasses = uiStyles;
export const motionClasses = motion;

export function css(modules: CssModule | CssModule[], classNames: string | false | null | undefined): string {
  if (!classNames) return '';
  const maps = Array.isArray(modules) ? modules : [modules];
  return classNames
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => maps.find((module) => module[name])?.[name] || name)
    .join(' ');
}

export function createPageCn(pageModule: CssModule, extra: CssModule[] = []) {
  const modules = [uiStyles, motion, pageModule, ...extra];
  return (classNames: string | false | null | undefined) => css(modules, classNames);
}

export function staggerStyle(index: number): CSSProperties {
  return { '--stagger-index': index } as CSSProperties;
}
