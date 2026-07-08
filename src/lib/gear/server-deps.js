import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { getLocalCachedJson } from './local-cache.js';

export function serverGearDeps(env = {}, options = {}) {
  const dataDir = resolve(options.dataDir || env.GEAR_DATA_DIR || 'public/data/gear');
  const sourceAliasesFile = options.sourceAliasesFile || env.GEAR_SOURCE_ALIASES_FILE || '';
  const cacheTtlSeconds = positiveNumber(env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800);
  return {
    apiKey: env.BUNGIE_API_KEY,
    locale: env.BUNGIE_LOCALE || 'zh-chs',
    cacheTtlSeconds,
    getLatestGearPointer: () => readLocalJson(dataDir, 'latest.json'),
    readGearJson: (relativePath) => readLocalGearJson(dataDir, relativePath, sourceAliasesFile),
    getCachedJson: (key, ttlSeconds, producer, cacheOptions) =>
      getLocalCachedJson(key, ttlSeconds ?? cacheTtlSeconds, producer, cacheOptions)
  };
}

async function readLocalGearJson(dataDir, relativePath, sourceAliasesFile) {
  if (isSourceAliasesPath(relativePath) && sourceAliasesFile) {
    const aliases = await readJsonFile(resolve(sourceAliasesFile));
    if (aliases) return aliases;
  }
  return readLocalJson(dataDir, relativePath);
}

async function readLocalJson(dataDir, relativePath) {
  const absolutePath = resolve(dataDir, relativePath);
  if (!isInsideDirectory(absolutePath, dataDir)) return null;
  return readJsonFile(absolutePath);
}

async function readJsonFile(absolutePath) {
  try {
    return JSON.parse(await readFile(absolutePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function isSourceAliasesPath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  return normalized === 'source-aliases.json' || normalized.endsWith('/source-aliases.json');
}

function isInsideDirectory(filePath, directory) {
  const normalizedDirectory = directory.endsWith(sep) ? directory : `${directory}${sep}`;
  return filePath.startsWith(normalizedDirectory);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
