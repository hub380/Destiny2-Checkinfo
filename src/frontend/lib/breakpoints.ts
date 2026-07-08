/** Shared layout breakpoints (px). */
export const BREAKPOINT_MD = 980;
export const BREAKPOINT_SM = 640;

export function isMdUp(width = typeof window !== 'undefined' ? window.innerWidth : BREAKPOINT_MD) {
  return width > BREAKPOINT_MD;
}
