import { positiveNumber } from '../http/index.js';

export function summaryCacheTtlSeconds(env) {
  return positiveNumber(env.SUMMARY_CACHE_TTL_SECONDS, positiveNumber(env.CAREER_CACHE_TTL_SECONDS, 300));
}

export function endgameCacheTtlSeconds(env) {
  return positiveNumber(env.ENDGAME_CACHE_TTL_SECONDS, positiveNumber(env.CAREER_CACHE_TTL_SECONDS, 900));
}

export function guideIndexCacheTtlSeconds(env) {
  return positiveNumber(env.GUIDE_INDEX_CACHE_TTL_SECONDS, 300);
}

export function activityDefinitionCacheTtlSeconds(env) {
  return positiveNumber(env.ACTIVITY_DEFINITION_CACHE_TTL_SECONDS, 31536000);
}

export function activityDefinitionConcurrency(env) {
  return Math.max(1, Math.min(6, positiveNumber(env.ACTIVITY_DEFINITION_CONCURRENCY, 4)));
}
