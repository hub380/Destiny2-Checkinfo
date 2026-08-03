import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGearIndex } from '../../src/lib/gear/index.js';
import { writeSplitGearIndex } from '../../src/lib/gear/split-writer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.env.local'), { override: true });

const locale = process.env.BUNGIE_LOCALE || 'zh-chs';
const outputDir = path.join(rootDir, 'public', 'data');
const outputFile = path.join(outputDir, `gear-index-${locale}.json`);
const splitOutputDir = path.join(outputDir, 'gear');
const sourceAliasesFile = path.join(rootDir, 'content', 'gear', 'source-aliases.json');
const raidAliasesFile = path.join(rootDir, 'content', 'gear', 'source-aliases-raids.json');
const dungeonAliasesFile = path.join(rootDir, 'content', 'gear', 'source-aliases-dungeons.json');
const rollRecommendationsFile = path.join(rootDir, 'content', 'gear', 'roll-recommendations.json');
const lightggRecommendationsFile = path.join(rootDir, 'content', 'gear', 'lightgg-roll-recommendations.json');
const generatedLightggRecommendationsFile = path.join(rootDir, 'work', 'lightgg', 'lightgg-roll-recommendations.json');
const lightggPerkDetailsFile = path.join(rootDir, 'work', 'lightgg', 'lightgg-perk-details.json');
const searchAliasesFile = path.join(rootDir, 'content', 'gear', 'search-aliases.json');
const maxBytes = Math.max(
  positiveNumber(process.env.GEAR_MANIFEST_MAX_BYTES, 0),
  positiveNumber(process.env.GEAR_INDEX_BUILD_MAX_BYTES, 500_000_000)
);

if (!process.env.BUNGIE_API_KEY) {
  throw new Error('BUNGIE_API_KEY is required to build the gear index.');
}

mkdirSync(outputDir, { recursive: true });

const startedAt = Date.now();
const index = await buildGearIndex({
  apiKey: process.env.BUNGIE_API_KEY,
  locale,
  timeoutMs: positiveNumber(process.env.GEAR_MANIFEST_TIMEOUT_MS, 60000),
  maxBytes,
  searchAliases: readSearchAliases(searchAliasesFile)
});

if (process.env.GEAR_WRITE_LEGACY_INDEX === '1') {
  const serialized = JSON.stringify(index);
  writeFileSync(outputFile, serialized);
  console.log(`Wrote legacy ${path.relative(rootDir, outputFile)} (${formatBytes(Buffer.byteLength(serialized))})`);
}

const { latestPointer } = await writeSplitGearIndex(index, {
  outputDir: splitOutputDir,
  sourceAliasesFile,
  raidAliasesFile,
  dungeonAliasesFile,
  rollRecommendationFiles: [
    rollRecommendationsFile,
    lightggRecommendationsFile,
    generatedLightggRecommendationsFile
  ],
  perkDetailsFile: lightggPerkDetailsFile,
  locale
});

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`Wrote ${path.relative(rootDir, splitOutputDir)} (${formatBytes(latestPointer.byteSize)}) in ${seconds}s`);
console.log(`Items: ${index.items.length}, weapons: ${index.weapons.length}, manifest: ${index.manifestVersion || '-'}`);

function loadEnvFile(filePath, options = {}) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!options.override && process.env[key] !== undefined) continue;
    process.env[key] = stripEnvQuotes(rawValue.trim());
  }
}

function stripEnvQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readSearchAliases(filePath) {
  if (!existsSync(filePath)) return [];
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.aliases)) return raw.aliases;
  return [];
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
