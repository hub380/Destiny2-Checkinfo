import { normalizeText } from './utils.js';

export const GEAR_SPLIT_SCHEMA_VERSION = 2;
export const GEAR_SPLIT_PREFIX = 'gear-cache/v2';

/**
 * DJB2 hash over normalizeText(value) → deterministic sourceKey.
 * Single source of truth — used by split-writer.js and handlers.js alike.
 */
export function sourceKeyFor(value) {
  const normalized = normalizeText(value);
  let hash = 5381;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(index)) >>> 0;
  }
  return `src-${hash.toString(36)}`;
}

export function gearItemBucket(hash) {
  const value = safeHash(hash);
  return value.slice(-2).padStart(2, '0') || '00';
}

export function gearItemPath(hash) {
  const value = safeHash(hash);
  return `items/${gearItemBucket(value)}/${value}.json`;
}

export function perkWeaponsPath(hash) {
  return `perk-weapons/${safeHash(hash)}.json`;
}

export function searchShardPath(kind) {
  const name = searchShardName(kind);
  return `search/${name}.json`;
}

export function sourceIndexPath(sourceKey) {
  return `sources/${safeSegment(sourceKey)}.json`;
}

export function sourceAliasesPath() {
  return 'source-aliases.json';
}

export function raidAliasesPath() {
  return 'source-aliases-raids.json';
}

export function dungeonAliasesPath() {
  return 'source-aliases-dungeons.json';
}

export function joinGearPath(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .map((part) => trimSlashes(part))
    .filter(Boolean)
    .join('/');
}

export function latestR2Key(prefix, locale) {
  return joinGearPath(prefix || GEAR_SPLIT_PREFIX, locale, 'latest.json');
}

export function manifestRoot(prefix, locale, manifestVersion) {
  return joinGearPath(prefix || GEAR_SPLIT_PREFIX, locale, safeSegment(manifestVersion));
}

export function safeSegment(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}

export function trimSlashes(value) {
  return String(value || '').replace(/^[/]+|[/]+$/g, '');
}

function searchShardName(kind) {
  if (kind === 'weapon') return 'weapons';
  if (kind === 'armor') return 'armors';
  if (kind === 'perk') return 'perks';
  return safeSegment(kind);
}

function safeHash(hash) {
  return String(hash || '').replace(/[^0-9a-zA-Z_-]/g, '') || '0';
}
