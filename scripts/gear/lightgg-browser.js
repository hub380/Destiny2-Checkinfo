/* global document, location */

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_SETTLE_TIMEOUT_MS = 15000;
const DEFAULT_CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000;

export async function waitForLightggPage(page, options = {}) {
  const pollIntervalMs = positiveNumber(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);
  const settleTimeoutMs = positiveNumber(options.settleTimeoutMs, DEFAULT_SETTLE_TIMEOUT_MS);
  const challengeTimeoutMs = positiveNumber(
    options.challengeTimeoutMs,
    DEFAULT_CHALLENGE_TIMEOUT_MS
  );
  const startedAt = Date.now();
  let settleStartedAt = startedAt;
  let challengeStartedAt = null;
  let challengeWasActive = false;

  while (true) {
    const state = await inspectLightggPage(page);
    if (state.ready || state.notFound) return state;

    if (state.challenge) {
      challengeWasActive = true;
      if (challengeStartedAt === null) {
        challengeStartedAt = Date.now();
        options.onChallenge?.(state);
      }
      if (Date.now() - challengeStartedAt >= challengeTimeoutMs) {
        return { ...state, challengeTimedOut: true };
      }
    } else {
      if (challengeWasActive) {
        challengeWasActive = false;
        settleStartedAt = Date.now();
      }
      if (Date.now() - settleStartedAt >= settleTimeoutMs) {
        return { ...state, empty: true };
      }
    }

    await page.waitForTimeout(pollIntervalMs);
  }
}

export async function warmupLightggHome(page, options = {}) {
  const pollIntervalMs = positiveNumber(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);
  const challengeTimeoutMs = positiveNumber(
    options.challengeTimeoutMs,
    DEFAULT_CHALLENGE_TIMEOUT_MS
  );
  const response = await page.goto('https://www.light.gg/', {
    timeout: positiveNumber(options.navigationTimeoutMs, 45000),
    waitUntil: 'domcontentloaded'
  });
  const status = response?.status() || 0;
  if (status === 429) return { status, rateLimited: true, url: page.url() };
  if (status >= 500) throw new Error(`HTTP ${status}`);

  let challengeStartedAt = null;
  while (true) {
    const state = await inspectLightggPage(page);
    if (!state.challenge) return { ...state, status, warmedUp: true };

    if (challengeStartedAt === null) {
      challengeStartedAt = Date.now();
      options.onChallenge?.(state);
    }
    if (Date.now() - challengeStartedAt >= challengeTimeoutMs) {
      return { ...state, status, challengeTimedOut: true };
    }

    await page.waitForTimeout(pollIntervalMs);
  }
}

export async function extractLightggSnapshot(page) {
  return page.evaluate(() => {
    const comboRoot = document.querySelector('#trait-combos');
    const averageRoot = document.querySelector('#community-average');
    const hashMatch = location.pathname.match(/\/db\/items\/(\d+)/);
    if ((!comboRoot && !averageRoot) || !hashMatch) return null;

    const comboRows = comboRoot
      ? Array.from(comboRoot.children).slice(0, 20).map((row) => {
        const perkLinks = Array.from(row.querySelectorAll("a[href*='/db/items/']")).slice(0, 2);
        const perkHashes = perkLinks
          .map((link) => (link.getAttribute('href') || '').match(/\/db\/items\/(\d+)/)?.[1] || '')
          .filter(Boolean);
        const perkNames = Array.from(row.querySelectorAll('.perk-names > div'))
          .map((element) => (element.textContent || '').replace(/^\+\s*/, '').trim())
          .filter(Boolean);
        return {
          perkHashes,
          perkNames,
          text: (row.textContent || '').trim().replace(/\s+/g, ' ')
        };
      }).filter((row) => row.perkHashes.length === 2)
      : [];

    const individualColumns = averageRoot
      ? Array.from(averageRoot.children).slice(0, 10).map((column) =>
        Array.from(column.querySelectorAll(':scope > li')).slice(0, 50).map((item) => {
          const href = item.querySelector("a[href*='/db/items/']")?.getAttribute('href') || '';
          return {
            percentage: (item.querySelector('.percent')?.textContent || '').trim(),
            perkHash: href.match(/\/db\/items\/(\d+)/)?.[1] || ''
          };
        }).filter((item) => item.perkHash)
      )
      : [];

    const averageText = document.querySelector('#community-average-container')?.textContent || '';
    const sampleSizeText = (
      averageText.match(/Based on\s+[\d,.]+[KMB]?\+?[^.]*\./i)?.[0] || ''
    ).trim();

    return {
      collectedAt: new Date().toISOString(),
      comboRows,
      individualColumns,
      sampleSizeText,
      sourceUrl: location.href,
      title: document.title,
      weaponHash: Number(hashMatch[1])
    };
  });
}

export async function extractLightggPerkSnapshot(page) {
  return page.evaluate(() => {
    const hashMatch = location.pathname.match(/\/db\/items\/(\d+)/);
    if (!hashMatch) return null;
    const bodyText = document.body?.innerText || '';
    const start = bodyText.indexOf('Community Research');
    if (start < 0) return null;
    const detailsStart = bodyText.indexOf('Details', start);
    const end = detailsStart > start ? detailsStart : start + 3000;
    return {
      collectedAt: new Date().toISOString(),
      communityResearchText: bodyText.slice(start, end).trim(),
      perkHash: Number(hashMatch[1]),
      sourceUrl: location.href,
      title: document.title
    };
  });
}

export function classifyLightggPage(signals = {}) {
  const title = String(signals.title || '');
  const text = String(signals.text || '');
  return {
    challenge: signals.challenge === true
      || /just a moment|security verification|verify you are human|请稍候|正在验证/i.test(title)
      || /verify you are human|performing security verification|验证您是否是真人|正在进行安全验证/i.test(text)
      || signals.hasChallengeElement === true,
    notFound: signals.notFound === true
      || /item not found|page not found/i.test(title)
      || /we couldn't find that item|the requested item could not be found/i.test(text),
    ready: signals.ready === true
      || signals.hasTraitCombos === true
      || signals.hasCommunityAverage === true,
    title,
    url: String(signals.url || '')
  };
}

async function inspectLightggPage(page) {
  const signals = await page.evaluate(() => ({
    hasChallengeElement: Boolean(document.querySelector(
      "#challenge-running, #challenge-stage, iframe[src*='challenges.cloudflare.com']"
    )),
    hasCommunityAverage: Boolean(document.querySelector('#community-average')),
    hasTraitCombos: Boolean(document.querySelector('#trait-combos')),
    text: (document.body?.innerText || '').slice(0, 5000),
    title: document.title || '',
    url: location.href
  }));
  return classifyLightggPage(signals);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
