import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
loadEnvFile(path.join(rootDir, '.env'));

const locale = process.env.BUNGIE_LOCALE || 'zh-chs';
const outputDir = path.join(rootDir, 'public', 'data');
const outputFile = path.join(outputDir, `activity-index-${locale}.json`);
const apiKey = process.env.BUNGIE_API_KEY;

if (!apiKey) {
  throw new Error('BUNGIE_API_KEY is required to build the activity index.');
}

const startedAt = Date.now();
const manifest = await bungieJson('/Platform/Destiny2/Manifest/');
const manifestVersion = manifest.version || '';
const activityPath = manifest.jsonWorldComponentContentPaths?.[locale]?.DestinyActivityDefinition;

if (!activityPath) {
  throw new Error(`DestinyActivityDefinition JSON path was not found for locale ${locale}.`);
}

const definitions = await bungieJson(activityPath);
const activities = {};

for (const [hash, definition] of Object.entries(definitions || {})) {
  const mapped = mapActivityDefinition(hash, definition);
  if (!isUsefulActivityDefinition(mapped)) continue;
  activities[hash] = mapped;
}

mkdirSync(outputDir, { recursive: true });
const index = {
  locale,
  manifestVersion,
  generatedAt: new Date().toISOString(),
  activities
};
const serialized = JSON.stringify(index);
writeFileSync(outputFile, serialized);

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`Wrote ${path.relative(rootDir, outputFile)} (${formatBytes(Buffer.byteLength(serialized))}) in ${seconds}s`);
console.log(`Activities: ${Object.keys(activities).length}, manifest: ${manifestVersion || '-'}`);

async function bungieJson(pathname) {
  const response = await fetch(`https://www.bungie.net${pathname}`, {
    headers: {
      'x-api-key': apiKey,
      'accept-language': locale
    }
  });
  const payload = await response.json();
  if (!response.ok || (payload.ErrorCode && payload.ErrorCode !== 1)) {
    throw new Error(payload.Message || `Bungie returned HTTP ${response.status}`);
  }
  return payload.Response || payload;
}

function mapActivityDefinition(hash, definition) {
  const display = definition?.displayProperties || {};
  return {
    hash: String(hash),
    name: cleanText(display.name),
    description: cleanText(display.description),
    image: definition?.pgcrImage ? `https://www.bungie.net${definition.pgcrImage}` : '',
    activityTypeHash: definition?.activityTypeHash || null,
    modeTypes: Array.isArray(definition?.modeTypes) ? definition.modeTypes : [],
    directorActivityHash: definition?.directorActivityHash || null,
    placeHash: definition?.placeHash || null,
    destinationHash: definition?.destinationHash || null
  };
}

function isUsefulActivityDefinition(definition) {
  return Boolean(definition.name || definition.image);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = stripEnvQuotes(rawValue.trim());
  }
}

function stripEnvQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
