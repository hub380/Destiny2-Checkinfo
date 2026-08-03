import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildLightggCrawlQueue } from '../../src/lib/gear/lightgg-crawler.js';
import { parseLightggSnapshot } from '../../src/lib/gear/lightgg-cache.js';
import {
  extractLightggSnapshot,
  warmupLightggHome,
  waitForLightggPage
} from './lightgg-browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const settings = readSettings();
let stopRequested = false;

process.once('SIGINT', requestStop);
process.once('SIGTERM', requestStop);

await mkdir(settings.snapshotDir, { recursive: true });
await mkdir(path.dirname(settings.stateFile), { recursive: true });
await mkdir(settings.profileDir, { recursive: true });

const latestPointer = await readJson(settings.latestFile);
const searchFile = path.join(
  path.dirname(settings.latestFile),
  latestPointer.root,
  'search',
  'weapons.json'
);
const searchShard = await readJson(searchFile);
const previousState = await readJsonOptional(settings.stateFile);
const crawlState = normalizeState(previousState, latestPointer.manifestVersion);
const snapshotHashes = settings.recrawl ? new Set() : await readSnapshotHashes(settings.snapshotDir);
const queue = buildLightggCrawlQueue(searchShard.items, {
  snapshotHashes,
  crawlItems: settings.recrawl ? {} : crawlState.items,
  retryEmpty: settings.retryEmpty,
  retryFailed: settings.retryFailed,
  limit: settings.limit
});

printPlan(queue, searchShard.items?.length || 0, snapshotHashes.size);
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
let completedThisRun = 0;
let shouldAbort = false;

try {
  if (settings.warmupHome) {
    shouldAbort = await warmupHomeSession(page, settings);
  }
  for (const [index, weapon] of queue.entries()) {
    if (stopRequested || shouldAbort) break;
    const position = `${index + 1}/${queue.length}`;
    console.log(`[${position}] ${weapon.name || 'Unknown'} (${weapon.hash})`);

    const result = await crawlWeapon(page, weapon, settings);
    crawlState.items[String(weapon.hash)] = result.record;
    crawlState.updatedAt = new Date().toISOString();
    await writeJsonAtomic(settings.stateFile, crawlState);
    completedThisRun += result.record.status === 'saved' ? 1 : 0;
    shouldAbort = result.abort === true;

    console.log(`  ${formatResult(result.record)}`);
    if (!stopRequested && !shouldAbort && index < queue.length - 1) {
      await sleep(randomDelay(settings.minDelayMs, settings.maxDelayMs));
    }
  }
} finally {
  crawlState.updatedAt = new Date().toISOString();
  await writeJsonAtomic(settings.stateFile, crawlState);
  await context.close().catch(() => {});
}

console.log(`Crawl stopped. Saved ${completedThisRun} new weapon snapshots this run.`);
console.log('Run npm run gear:lightgg:compile and npm run gear:recommendations to rebuild caches.');
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

async function crawlWeapon(page, weapon, config) {
  const previousAttempts = Number(crawlState.items[String(weapon.hash)]?.attempts || 0);

  for (let offset = 1; offset <= config.maxAttempts; offset += 1) {
    const attempts = previousAttempts + offset;
    const attemptedAt = new Date().toISOString();
    try {
      const response = await page.goto(`https://www.light.gg/db/items/${weapon.hash}/`, {
        timeout: config.navigationTimeoutMs,
        waitUntil: 'domcontentloaded'
      });
      const status = response?.status() || 0;
      if (status === 429) {
        return failureRecord('rate-limited', attempts, attemptedAt, 'HTTP 429', true);
      }
      if (status >= 500) throw new Error(`HTTP ${status}`);

      const pageState = await waitForLightggPage(page, {
        challengeTimeoutMs: config.challengeTimeoutMs,
        settleTimeoutMs: config.settleTimeoutMs,
        onChallenge: () => {
          console.warn('  Cloudflare verification detected. Complete it in Chrome; collection is paused.');
        }
      });

      if (pageState.challengeTimedOut) {
        return failureRecord(
          'challenge',
          attempts,
          attemptedAt,
          'Cloudflare verification timed out',
          true
        );
      }
      if (pageState.notFound) {
        return statusRecord('empty', attempts, attemptedAt, { reason: 'not-found' });
      }

      const snapshot = await extractLightggSnapshot(page);
      const parsed = parseLightggSnapshot(snapshot);
      if (!snapshot || !parsed) {
        return statusRecord('empty', attempts, attemptedAt, {
          reason: 'no-recommendations',
          pageTitle: String(pageState.title || '').slice(0, 200),
          pageUrl: String(pageState.url || '').slice(0, 300)
        });
      }
      if (snapshot.weaponHash !== weapon.hash) {
        throw new Error(`Unexpected item hash ${snapshot.weaponHash || 'unknown'}`);
      }

      await writeJsonAtomic(path.join(config.snapshotDir, `${weapon.hash}.json`), snapshot);
      return statusRecord('saved', attempts, attemptedAt, {
        combos: parsed.popularTraitCombos.length,
        individualPerks: parsed.popularIndividualPerks.reduce(
          (sum, column) => sum + column.perks.length,
          0
        ),
        sampleSize: parsed.sampleSize,
        sourceUrl: parsed.sourceUrl
      });
    } catch (error) {
      const message = safeMessage(error);
      if (offset >= config.maxAttempts) {
        return failureRecord('failed', attempts, attemptedAt, message, false);
      }
      console.warn(`  Attempt ${offset} failed: ${message}. Retrying with backoff.`);
      await sleep(config.retryDelayMs * offset);
    }
  }

  return failureRecord('failed', previousAttempts, new Date().toISOString(), 'Unknown error', false);
}

function readSettings() {
  const chromePath = findChromePath(process.env.LIGHTGG_CHROME_PATH);
  const latestFile = path.resolve(
    rootDir,
    process.env.LIGHTGG_GEAR_LATEST_FILE || path.join('public', 'data', 'gear', 'latest.json')
  );
  const minDelayMs = integerSetting('LIGHTGG_MIN_DELAY_MS', 7000, 1000);
  const maxDelayMs = Math.max(
    minDelayMs,
    integerSetting('LIGHTGG_MAX_DELAY_MS', 12000, minDelayMs)
  );
  return {
    challengeTimeoutMs: integerSetting('LIGHTGG_CHALLENGE_TIMEOUT_MS', 10 * 60 * 1000, 30000),
    chromePath,
    dryRun: booleanSetting('LIGHTGG_DRY_RUN'),
    headless: booleanSetting('LIGHTGG_HEADLESS'),
    latestFile,
    limit: integerSetting('LIGHTGG_LIMIT', 0, 0),
    maxAttempts: integerSetting('LIGHTGG_MAX_ATTEMPTS', 2, 1),
    maxDelayMs,
    minDelayMs,
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
    retryEmpty: booleanSetting('LIGHTGG_RETRY_EMPTY'),
    retryFailed: process.env.LIGHTGG_RETRY_FAILED !== '0',
    settleTimeoutMs: integerSetting('LIGHTGG_SETTLE_TIMEOUT_MS', 15000, 3000),
    snapshotDir: path.resolve(
      rootDir,
      process.env.LIGHTGG_SNAPSHOT_DIR || path.join('work', 'lightgg', 'items')
    ),
    stateFile: path.resolve(
      rootDir,
      process.env.LIGHTGG_STATE_FILE || path.join('work', 'lightgg', 'crawl-state.json')
    ),
    warmupHome: process.env.LIGHTGG_WARMUP_HOME !== '0'
  };
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

function normalizeState(value, manifestVersion) {
  return {
    schemaVersion: 1,
    manifestVersion,
    createdAt: value?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: value?.items && typeof value.items === 'object' ? value.items : {}
  };
}

function statusRecord(status, attempts, attemptedAt, details = {}) {
  return { record: { status, attempts, lastAttemptAt: attemptedAt, ...details } };
}

function failureRecord(status, attempts, attemptedAt, message, abort) {
  return {
    abort,
    record: {
      status,
      attempts,
      lastAttemptAt: attemptedAt,
      message: String(message || 'Unknown error').slice(0, 300)
    }
  };
}

async function readSnapshotHashes(directory) {
  let names = [];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return new Set(
    names
      .filter((name) => /^\d+\.json$/i.test(name))
      .map((name) => Number.parseInt(name, 10))
  );
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readJsonOptional(file) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, file);
}

function printPlan(queue, totalWeapons, cachedSnapshots) {
  console.log(`Light.gg weapons in search index: ${totalWeapons}.`);
  console.log(`Existing valid snapshots: ${cachedSnapshots}.`);
  console.log(`Queued this run: ${queue.length}.`);
  if (settings.dryRun) {
    console.log('Dry run; Chrome will not be launched.');
    console.log(queue.slice(0, 10).map((item) => `${item.hash} ${item.name}`).join('\n'));
  }
}

function formatResult(record) {
  if (record.status === 'saved') {
    return `saved (${record.combos} combos, ${record.individualPerks} individual perks)`;
  }
  const page = record.pageTitle ? ` [${record.pageTitle}]` : '';
  return `${record.status}${record.reason ? ` (${record.reason})` : ''}${page}${
    record.message ? `: ${record.message}` : ''
  }`;
}

function safeMessage(error) {
  return String(error?.message || error || 'Unknown error')
    .replace(rootDir, '<workspace>')
    .slice(0, 300);
}

function integerSetting(name, fallback, minimum) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}

function booleanSetting(name) {
  return /^(1|true|yes)$/i.test(String(process.env[name] || ''));
}

function randomDelay(minimum, maximum) {
  return Math.floor(minimum + Math.random() * (maximum - minimum + 1));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requestStop() {
  if (!stopRequested) console.log('Stop requested; finishing the current item and saving state.');
  stopRequested = true;
}
