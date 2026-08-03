import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  extractLightggPerkSnapshot,
  warmupLightggHome,
  waitForLightggPage
} from './lightgg-browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_PERK_CATEGORIES = new Set([
  'frames',
  'intrinsics',
  'origins',
  'catalysts',
  'artifact_perks'
]);
const settings = readSettings();
let stopRequested = false;

process.once('SIGINT', requestStop);
process.once('SIGTERM', requestStop);

await mkdir(settings.snapshotDir, { recursive: true });
await mkdir(settings.skipDir, { recursive: true });
await mkdir(path.dirname(settings.stateFile), { recursive: true });
await mkdir(settings.profileDir, { recursive: true });

const queue = await buildQueue(settings);
console.log(`Light.gg perk detail queue: ${queue.length}`);
if (settings.dryRun || queue.length === 0) process.exit(0);

const launchOptions = {
  acceptDownloads: false,
  headless: settings.headless,
  viewport: null
};
if (settings.chromePath) launchOptions.executablePath = settings.chromePath;
else launchOptions.channel = 'chrome';

const context = await chromium.launchPersistentContext(settings.profileDir, launchOptions);
const pages = context.pages();
const page = pages[0] || await context.newPage();
let saved = 0;
let shouldAbort = false;

try {
  if (settings.warmupHome) {
    shouldAbort = await warmupHomeSession(page, settings);
  }
  for (const [index, perk] of queue.entries()) {
    if (stopRequested || shouldAbort) break;
    const position = `${index + 1}/${queue.length}`;
    console.log(`[${position}] ${perk.name || 'Unknown'} (${perk.hash})`);
    const result = await crawlPerk(page, perk, settings);
    saved += result.status === 'saved' ? 1 : 0;
    if (shouldRememberSkip(result)) {
      await writeJsonAtomic(path.join(settings.skipDir, `${perk.hash}.json`), {
        hash: perk.hash,
        name: perk.name || '',
        status: result.status,
        message: result.message || '',
        checkedAt: new Date().toISOString()
      });
    }
    shouldAbort = result.abort === true;
    console.log(`  ${result.status}${result.message ? `: ${result.message}` : ''}`);
    if (!stopRequested && !shouldAbort && index < queue.length - 1) {
      await sleep(randomDelay(settings.minDelayMs, settings.maxDelayMs));
    }
  }
} finally {
  await context.close().catch(() => {});
}

console.log(`Perk detail crawl stopped. Saved ${saved} snapshots this run.`);
console.log('Run npm run gear:lightgg:perks:compile and npm run gear:index to rebuild gear item details.');
if (shouldAbort) process.exitCode = 2;

async function warmupHomeSession(page, config) {
  console.log('Warming up Light.gg home session.');
  try {
    const state = await warmupLightggHome(page, {
      challengeTimeoutMs: config.challengeTimeoutMs,
      navigationTimeoutMs: config.navigationTimeoutMs,
      onChallenge: () => {
        console.warn('  Cloudflare verification detected on Light.gg home. Complete it in Chrome; collection is paused.');
      }
    });
    if (state.rateLimited) {
      console.warn('  Light.gg home returned HTTP 429.');
      return true;
    }
    if (state.challengeTimedOut) {
      console.warn('  Cloudflare verification timed out on Light.gg home.');
      return true;
    }
    console.log('  Home session ready.');
    return false;
  } catch (error) {
    console.warn(`  Home warmup failed: ${safeMessage(error)}`);
    return false;
  }
}

async function crawlPerk(page, perk, config) {
  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      const response = await page.goto(`https://www.light.gg/db/items/${perk.hash}/`, {
        timeout: config.navigationTimeoutMs,
        waitUntil: 'domcontentloaded'
      });
      const status = response?.status() || 0;
      if (status === 429) return { status: 'rate-limited', message: 'HTTP 429', abort: true };
      if (status >= 500) throw new Error(`HTTP ${status}`);

      const pageState = await waitForLightggPage(page, {
        challengeTimeoutMs: config.challengeTimeoutMs,
        settleTimeoutMs: config.settleTimeoutMs,
        onChallenge: () => {
          console.warn('  Cloudflare verification detected. Complete it in Chrome; collection is paused.');
        }
      });
      if (pageState.challengeTimedOut) {
        return { status: 'challenge', message: 'Cloudflare verification timed out', abort: true };
      }
      if (pageState.notFound) return { status: 'empty', message: 'not found' };

      const snapshot = await extractLightggPerkSnapshot(page);
      if (!snapshot?.communityResearchText) return { status: 'empty', message: 'no community research' };
      if (Number(snapshot.perkHash) !== Number(perk.hash)) {
        throw new Error(`Unexpected item hash ${snapshot.perkHash || 'unknown'}`);
      }

      await writeJsonAtomic(path.join(config.snapshotDir, `${perk.hash}.json`), snapshot);
      return { status: 'saved' };
    } catch (error) {
      if (attempt >= config.maxAttempts) {
        return { status: 'failed', message: safeMessage(error) };
      }
      console.warn(`  Attempt ${attempt} failed: ${safeMessage(error)}. Retrying.`);
      await sleep(config.retryDelayMs * attempt);
    }
  }
  return { status: 'failed', message: 'Unknown error' };
}

async function buildQueue(config) {
  const explicitHashes = String(process.env.LIGHTGG_PERK_HASHES || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  const existing = config.recrawl ? new Set() : await readSnapshotHashes(config.snapshotDir);
  const skipped = config.recrawl ? new Set() : await readSnapshotHashes(config.skipDir);
  if (explicitHashes.length) {
    return explicitHashes
      .filter((hash) => config.recrawl || (!existing.has(hash) && !skipped.has(hash)))
      .map((hash) => ({ hash, name: '' }))
      .slice(0, config.limit || undefined);
  }

  const latestPointer = await readJson(config.latestFile);
  const searchFile = path.join(path.dirname(config.latestFile), latestPointer.root, 'search', 'perks.json');
  const searchShard = await readJson(searchFile);
  return (searchShard.items || [])
    .filter((perk) => config.includeAll || shouldCrawlPerkDetails(perk, config.categories))
    .filter((perk) => {
      const hash = Number(perk.hash);
      return hash && (config.recrawl || (!existing.has(hash) && !skipped.has(hash)));
    })
    .map((perk) => ({ hash: Number(perk.hash), name: perk.name || '' }))
    .slice(0, config.limit || undefined);
}

function readSettings() {
  const chromePath = findChromePath(process.env.LIGHTGG_CHROME_PATH);
  const latestFile = path.resolve(
    rootDir,
    process.env.LIGHTGG_GEAR_LATEST_FILE || path.join('public', 'data', 'gear', 'latest.json')
  );
  const minDelayMs = integerSetting('LIGHTGG_PERK_MIN_DELAY_MS', 5000, 1000);
  const maxDelayMs = Math.max(
    minDelayMs,
    integerSetting('LIGHTGG_PERK_MAX_DELAY_MS', 9000, minDelayMs)
  );
  return {
    challengeTimeoutMs: integerSetting('LIGHTGG_CHALLENGE_TIMEOUT_MS', 10 * 60 * 1000, 30000),
    chromePath,
    dryRun: booleanSetting('LIGHTGG_DRY_RUN'),
    headless: booleanSetting('LIGHTGG_HEADLESS'),
    includeAll: booleanSetting('LIGHTGG_PERK_INCLUDE_ALL'),
    latestFile,
    limit: integerSetting('LIGHTGG_PERK_LIMIT', 0, 0),
    maxAttempts: integerSetting('LIGHTGG_MAX_ATTEMPTS', 2, 1),
    maxDelayMs,
    minDelayMs,
    categories: categorySetting('LIGHTGG_PERK_CATEGORIES', DEFAULT_PERK_CATEGORIES),
    navigationTimeoutMs: integerSetting('LIGHTGG_NAVIGATION_TIMEOUT_MS', 45000, 10000),
    profileDir: path.resolve(
      rootDir,
      process.env.LIGHTGG_PROFILE_DIR || path.join(
        'work',
        'lightgg',
        chromePath ? 'custom-chrome-profile' : 'chrome-profile'
      )
    ),
    recrawl: booleanSetting('LIGHTGG_RECRAWL'),
    retryDelayMs: integerSetting('LIGHTGG_RETRY_DELAY_MS', 15000, 1000),
    settleTimeoutMs: integerSetting('LIGHTGG_SETTLE_TIMEOUT_MS', 15000, 3000),
    snapshotDir: path.resolve(
      rootDir,
      process.env.LIGHTGG_PERK_SNAPSHOT_DIR || path.join('work', 'lightgg', 'perks')
    ),
    skipDir: path.resolve(
      rootDir,
      process.env.LIGHTGG_PERK_SKIP_DIR || path.join('work', 'lightgg', 'perk-skips')
    ),
    stateFile: path.resolve(
      rootDir,
      process.env.LIGHTGG_PERK_STATE_FILE || path.join('work', 'lightgg', 'perk-crawl-state.json')
    ),
    warmupHome: process.env.LIGHTGG_WARMUP_HOME !== '0'
  };
}

function shouldRememberSkip(result) {
  return result?.status === 'empty';
}

function shouldCrawlPerkDetails(perk, categories) {
  const category = String(perk?.category || '').toLowerCase();
  return categories.has(category);
}

function categorySetting(name, fallback) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  return new Set(raw.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function findChromePath(explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!existsSync(resolved)) throw new Error(`Chrome not found at ${resolved}`);
    return resolved;
  }
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)']
      && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA
      && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || '';
}

async function readSnapshotHashes(directory) {
  let names = [];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return new Set(names.map((name) => Number(name.match(/^(\d+)\.json$/)?.[1])).filter(Boolean));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, filePath);
}

function integerSetting(name, fallback, min) {
  const number = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(number) && number >= min ? number : fallback;
}

function booleanSetting(name) {
  return /^(1|true|yes)$/i.test(String(process.env[name] || ''));
}

function randomDelay(min, max) {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function requestStop() {
  stopRequested = true;
  console.warn('Stop requested. Finishing current page before exit.');
}
