const MAX_LINES = 8;
const MAX_LINE_LENGTH = 320;

export function parseLightggPerkSnapshot(snapshot) {
  const perkHash = destinyHash(snapshot?.perkHash);
  if (!perkHash) return null;
  const communityResearch = parseCommunityResearch(snapshot?.communityResearchText);
  if (!communityResearch.lines.length) return null;
  return {
    perkHash,
    name: perkNameFromTitle(snapshot?.title),
    sourceUrl: safeLightggUrl(snapshot?.sourceUrl, perkHash),
    collectedAt: validIsoDate(snapshot?.collectedAt),
    communityResearch
  };
}

export function compileLightggPerkDetails(snapshots, options = {}) {
  const byHash = new Map();
  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    const item = parseLightggPerkSnapshot(snapshot);
    if (!item) continue;
    const existing = byHash.get(item.perkHash);
    if (!existing || timestamp(item.collectedAt) > timestamp(existing.collectedAt)) {
      byHash.set(item.perkHash, item);
    }
  }
  const items = Array.from(byHash.values()).sort((left, right) => left.perkHash - right.perkHash);
  return {
    schemaVersion: 1,
    source: 'light.gg',
    generatedAt: validIsoDate(options.generatedAt),
    counts: {
      perks: items.length,
      lines: items.reduce((sum, item) => sum + item.communityResearch.lines.length, 0)
    },
    items
  };
}

export function normalizeLightggPerkDetails(raw) {
  const map = new Map();
  const items = Array.isArray(raw) ? raw : raw?.items;
  for (const item of Array.isArray(items) ? items : []) {
    const perkHash = destinyHash(item?.perkHash ?? item?.hash);
    const lines = Array.isArray(item?.communityResearch?.lines)
      ? item.communityResearch.lines
      : Array.isArray(item?.lines)
        ? item.lines
        : [];
    const valueLines = cleanValueLines(lines);
    if (!perkHash || !valueLines.length) continue;
    map.set(perkHash, {
      source: 'light.gg',
      sourceUrl: safeLightggUrl(item?.sourceUrl, perkHash),
      collectedAt: validIsoDate(item?.collectedAt),
      updatedAt: safeText(item?.communityResearch?.updatedAt || item?.updatedAt),
      lines: valueLines
    });
  }
  return map;
}

function parseCommunityResearch(value) {
  const rawLines = String(value || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
  const updatedAt = updatedAtFromLines(rawLines);
  const lines = cleanValueLines(rawLines.filter((line) => !isChromeLine(line)));
  return { updatedAt, lines };
}

function cleanValueLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => normalizeLine(line))
    .filter((line) => line && hasConcreteValue(line))
    .map(localizeResearchLine)
    .slice(0, MAX_LINES);
}

function normalizeLine(value) {
  return safeText(value)
    .replace(/^[-•]\s*/, '')
    .replace(/🠚/g, '→')
    .replace(/🡅/g, '↑')
    .replace(/↑\s*↑+/g, '↑')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_LINE_LENGTH)
    .trim();
}

function hasConcreteValue(line) {
  return /(?:\d|%|second|seconds|秒|x\d|↑\s*\d|→)/i.test(line);
}

function isChromeLine(line) {
  return /^(Community Research|Credits|Remove All Ads|Share)$/i.test(line)
    || /^Last Updated\b/i.test(line);
}

function localizeResearchLine(line) {
  const normalized = normalizeLine(line);
  const baitTimer = normalized.match(/^Dealing damage with a weapon starts a ([\d.]+) second timer\. Dealing additional weapon damage resets the timer to ([\d.]+) seconds\.$/i);
  if (baitTimer) {
    return `造成武器伤害会启动 ${baitTimer[1]} 秒计时器；继续造成武器伤害会重置为 ${baitTimer[2]} 秒。`;
  }

  const simpleDamageTimer = normalized.match(/^Dealing damage with a weapon starts a ([\d.]+) second timer\.$/i);
  if (simpleDamageTimer) return `造成武器伤害会启动 ${simpleDamageTimer[1]} 秒计时器。`;

  const simpleDamageBonus = normalized.match(/^Grants ([\d.]+)% increased damage for ([\d.]+) seconds\.$/i);
  if (simpleDamageBonus) return `获得 ${simpleDamageBonus[1]}% 增伤，持续 ${simpleDamageBonus[2]} 秒。`;

  const baitDamage = normalized.match(/^Dealing damage with all 3 of your weapons without letting the timer run out grants you '([^']+)' for (?:↑ )?([\d.]+) seconds, granting ([\d.]+)% increased damage\.$/i);
  if (baitDamage) {
    return `计时结束前用 3 把武器均造成伤害，获得“${perkNameZh(baitDamage[1])}”${baitDamage[2]} 秒，提供 ${baitDamage[3]}% 增伤。`;
  }

  const buffDuration = normalized.match(/^↑ Buff Duration is increased by ([\d.]+) second(?:s)?\.$/i);
  if (buffDuration) return `增益持续时间 +${buffDuration[1]} 秒。`;

  const singleShot = normalized.match(/^Scoring 3 hits with at least ([\d.]+) seconds or at most ([\d.]+) seconds between each other grants (.+?) Reload Speed and ↑ ([\d.]+)% \[PVP: (.+?)\] increased damage for ([\d.]+) seconds\.$/i);
  if (singleShot) {
    return `单发武器：命中 3 次，间隔 ${singleShot[1]}-${singleShot[2]} 秒，获得 ${singleShot[3]} 装填速度与 ${singleShot[4]}% [PVP: ${singleShot[5]}] 增伤，持续 ${singleShot[6]} 秒。`;
  }

  const refreshTimer = normalized.match(/^Additional hits while the buff duration is below ([\d.]+) seconds refresh the timer to ([\d.]+) seconds\.$/i);
  if (refreshTimer) {
    return `增益剩余时间低于 ${refreshTimer[1]} 秒时，继续命中会刷新至 ${refreshTimer[2]} 秒。`;
  }

  const multiShot = normalized.match(/^Scoring 3 hits with at least ([\d.]+) seconds or at most ([\d.]+) seconds between each other refills ([\d.]+)% of the magazine and grants ↑ ([\d.]+)% \[PVP: (.+?)\] increased damage for ([\d.]+) seconds\.$/i);
  if (multiShot) {
    return `多发武器：命中 3 次，间隔 ${multiShot[1]}-${multiShot[2]} 秒，填装 ${multiShot[3]}% 弹匣并获得 ${multiShot[4]}% [PVP: ${multiShot[5]}] 增伤，持续 ${multiShot[6]} 秒。`;
  }

  const damageBonus = normalized.match(/^↑ Damage bonus is increased by ([\d.]+)% \(([\d.]+)%→([\d.]+)%\)\.$/i);
  if (damageBonus) {
    return `伤害加成提高 ${damageBonus[1]}%（${damageBonus[2]}%→${damageBonus[3]}%）。`;
  }

  return fallbackLocalize(normalized);
}

function fallbackLocalize(line) {
  return line
    .replace(/\bseconds\b/gi, '秒')
    .replace(/\bsecond\b/gi, '秒')
    .replace(/\bgrants\b/gi, '获得')
    .replace(/\bgranting\b/gi, '提供')
    .replace(/\bincreased damage\b/gi, '增伤')
    .replace(/\bdamage bonus\b/gi, '伤害加成')
    .replace(/\bReload Speed\b/g, '装填速度')
    .replace(/\bmagazine\b/gi, '弹匣')
    .replace(/\bbuff duration\b/gi, '增益持续时间')
    .replace(/\bLast Updated\b/gi, '更新');
}

function perkNameZh(name) {
  if (name === 'Bait and Switch') return '诱导推销';
  return name;
}

function updatedAtFromLines(lines) {
  const match = lines.find((line) => /^Last Updated\b/i.test(line));
  return safeText(match?.replace(/^Last Updated\s*/i, ''));
}

function destinyHash(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > 0xffffffff) return null;
  return number;
}

function perkNameFromTitle(title) {
  return safeText(title).split(/\s+-\s+Destiny 2\b/i)[0].slice(0, 160);
}

function safeLightggUrl(value, perkHash) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol === 'https:' && url.hostname === 'www.light.gg') return url.href;
  } catch {
    // Use the canonical public item URL below.
  }
  return `https://www.light.gg/db/items/${perkHash}/`;
}

function validIsoDate(value) {
  const date = new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function timestamp(value) {
  const number = new Date(value).getTime();
  return Number.isFinite(number) ? number : 0;
}

function safeText(value) {
  return String(value || '').trim();
}
