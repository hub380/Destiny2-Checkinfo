const MAX_DESTINY_HASH = 0xffffffff;

export function buildLightggCrawlQueue(weapons, options = {}) {
  const snapshotHashes = normalizeHashSet(options.snapshotHashes);
  const crawlItems = options.crawlItems && typeof options.crawlItems === 'object'
    ? options.crawlItems
    : {};
  const retryEmpty = options.retryEmpty === true;
  const retryFailed = options.retryFailed !== false;
  const byHash = new Map();

  for (const weapon of Array.isArray(weapons) ? weapons : []) {
    const hash = destinyHash(weapon?.hash);
    if (!hash || byHash.has(hash)) continue;
    byHash.set(hash, {
      hash,
      name: String(weapon?.name || '').trim().slice(0, 160)
    });
  }

  const queue = Array.from(byHash.values())
    .filter((weapon) => {
      if (snapshotHashes.has(weapon.hash)) return false;
      const status = crawlItems[String(weapon.hash)]?.status;
      if (status === 'saved') return false;
      if (status === 'empty' && !retryEmpty) return false;
      if (status === 'failed' && !retryFailed) return false;
      return true;
    })
    .sort((left, right) => left.hash - right.hash);

  const limit = positiveInteger(options.limit);
  return limit ? queue.slice(0, limit) : queue;
}

function normalizeHashSet(values) {
  const hashes = new Set();
  for (const value of values instanceof Set ? values : []) {
    const hash = destinyHash(value);
    if (hash) hashes.add(hash);
  }
  return hashes;
}

function destinyHash(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > MAX_DESTINY_HASH) return null;
  return number;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
