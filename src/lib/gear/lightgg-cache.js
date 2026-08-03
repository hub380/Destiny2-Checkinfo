const MAX_DESTINY_HASH = 0xffffffff;
const MAX_COMBOS = 20;
const MAX_COLUMNS = 10;
const MAX_PERKS_PER_COLUMN = 50;

export function parseLightggSnapshot(snapshot) {
  const weaponHash = destinyHash(snapshot?.weaponHash);
  if (!weaponHash) return null;

  const popularTraitCombos = parseTraitCombos(snapshot?.comboRows);
  const popularIndividualPerks = parseIndividualPerks(snapshot?.individualColumns);
  if (!popularTraitCombos.length && !popularIndividualPerks.length) return null;

  const sourceUrl = safeLightggUrl(snapshot?.sourceUrl, weaponHash);
  return {
    weaponHash,
    weaponName: weaponNameFromTitle(snapshot?.title),
    sourceUrl,
    collectedAt: validIsoDate(snapshot?.collectedAt),
    sampleSize: sampleSizeFromText(snapshot?.sampleSizeText),
    popularTraitCombos,
    popularIndividualPerks
  };
}

export function compileLightggSnapshots(snapshots, options = {}) {
  const byWeaponHash = new Map();
  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    const item = parseLightggSnapshot(snapshot);
    if (!item) continue;
    const existing = byWeaponHash.get(item.weaponHash);
    if (!existing || timestamp(item.collectedAt) > timestamp(existing.collectedAt)) {
      byWeaponHash.set(item.weaponHash, item);
    }
  }

  const items = Array.from(byWeaponHash.values())
    .sort((left, right) => left.weaponHash - right.weaponHash);

  return {
    schemaVersion: 2,
    source: 'light.gg',
    generatedAt: validIsoDate(options.generatedAt),
    counts: {
      weapons: items.length,
      traitCombos: items.reduce((sum, item) => sum + item.popularTraitCombos.length, 0),
      individualPerks: items.reduce(
        (sum, item) => sum + item.popularIndividualPerks.reduce(
          (columnSum, column) => columnSum + column.perks.length,
          0
        ),
        0
      )
    },
    items
  };
}

function parseTraitCombos(rows) {
  const combos = [];
  for (const row of (Array.isArray(rows) ? rows : []).slice(0, MAX_COMBOS)) {
    const perkHashes = (Array.isArray(row?.perkHashes) ? row.perkHashes : [])
      .map(destinyHash)
      .filter(Boolean)
      .slice(0, 2);
    const popularity = percentage(row?.popularity ?? row?.percentage ?? row?.text);
    if (perkHashes.length !== 2 || popularity === null) continue;

    const perkNames = Array.isArray(row?.perkNames) ? row.perkNames : [];
    combos.push({
      popularity,
      sockets: perkHashes.map((perkHash, index) => ({
        socketIndex: index + 3,
        perkHashes: [perkHash],
        perkNames: cleanNames([perkNames[index]])
      }))
    });
  }
  return combos;
}

function parseIndividualPerks(columns) {
  const parsed = [];
  for (const [columnIndex, column] of (Array.isArray(columns) ? columns : [])
    .slice(0, MAX_COLUMNS)
    .entries()) {
    const perks = [];
    for (const entry of (Array.isArray(column) ? column : []).slice(0, MAX_PERKS_PER_COLUMN)) {
      const perkHash = destinyHash(entry?.perkHash ?? entry?.hash);
      const popularity = percentage(entry?.popularity ?? entry?.percentage);
      if (!perkHash || popularity === null) continue;
      perks.push({ perkHash, popularity });
    }
    if (perks.length) parsed.push({ columnIndex, perks });
  }
  return parsed;
}

function destinyHash(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > MAX_DESTINY_HASH) return null;
  return number;
}

function percentage(value) {
  const match = String(value ?? '').match(/([0-9]+(?:\.[0-9]+)?)\s*%?/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number < 0 || number > 100) return null;
  return number;
}

function cleanNames(values) {
  return values
    .map((value) => String(value || '').replace(/\*+$/g, '').trim().slice(0, 120))
    .filter(Boolean);
}

function weaponNameFromTitle(title) {
  return String(title || '')
    .split(/\s+-\s+Destiny 2\b/i)[0]
    .trim()
    .slice(0, 160);
}

function sampleSizeFromText(value) {
  const match = String(value || '').match(/Based on\s+([0-9.,]+[KMB]?\+?)/i);
  return match?.[1] || '';
}

function safeLightggUrl(value, weaponHash) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol === 'https:' && url.hostname === 'www.light.gg') return url.href;
  } catch {
    // Use the canonical public item URL below.
  }
  return `https://www.light.gg/db/items/${weaponHash}/`;
}

function validIsoDate(value) {
  const date = new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function timestamp(value) {
  const number = new Date(value).getTime();
  return Number.isFinite(number) ? number : 0;
}
