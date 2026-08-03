const LIGHTGG_SOURCE = 'light.gg';

export function normalizeLightggRollRecommendations(raw) {
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  return items
    .map(normalizeLightggWeapon)
    .filter(Boolean);
}

function normalizeLightggWeapon(entry) {
  const weaponHash = Number(entry?.weaponHash || entry?.hash);
  if (!Number.isFinite(weaponHash)) return null;

  const recommendations = [];
  for (const combo of Array.isArray(entry?.popularTraitCombos) ? entry.popularTraitCombos : []) {
    const normalized = normalizeCombo(combo, weaponHash, entry);
    if (normalized) recommendations.push(normalized);
  }

  for (const column of Array.isArray(entry?.popularIndividualPerks) ? entry.popularIndividualPerks : []) {
    for (const perk of Array.isArray(column?.perks) ? column.perks : []) {
      const normalized = normalizeIndividualPerk(perk, column, weaponHash, entry);
      if (normalized) recommendations.push(normalized);
    }
  }

  for (const roll of Array.isArray(entry?.recommendations) ? entry.recommendations : []) {
    const normalized = normalizeRecommendation(roll, weaponHash, entry);
    if (normalized) recommendations.push(normalized);
  }

  if (!recommendations.length) return null;
  return {
    weaponHash,
    mergeStrategy: 'append',
    recommendations
  };
}

function normalizeCombo(combo, weaponHash, parent) {
  const socketEntries = Array.isArray(combo?.sockets)
    ? combo.sockets
    : [
        { socketIndex: combo?.leftSocketIndex ?? combo?.socketIndexA ?? 3, perkHashes: combo?.leftPerkHashes || combo?.perkHashesA || [combo?.leftPerkHash || combo?.perkHashA] },
        { socketIndex: combo?.rightSocketIndex ?? combo?.socketIndexB ?? 4, perkHashes: combo?.rightPerkHashes || combo?.perkHashesB || [combo?.rightPerkHash || combo?.perkHashB] }
      ];
  const sockets = normalizeSockets(socketEntries);
  if (!sockets.length) return null;

  const popularity = Number(combo?.popularity ?? combo?.percent ?? combo?.usagePercent);
  const label = String(combo?.label || combo?.name || (
    Number.isFinite(popularity) && popularity > 0 ? `社区热度 ${formatPercent(popularity)}` : '社区热度'
  ));

  return {
    id: String(combo?.id || `lightgg-${weaponHash}-${sockets.map((socket) => socket.perkHashes.join('_')).join('-')}`),
    mode: normalizeMode(combo?.mode),
    label,
    source: LIGHTGG_SOURCE,
    sourceUrl: String(combo?.sourceUrl || parent?.sourceUrl || lightggItemUrl(weaponHash)),
    confidence: 'community',
    notes: String(combo?.notes || communityNote(combo)),
    sockets
  };
}

function normalizeIndividualPerk(perk, column, weaponHash, parent) {
  const perkHash = Number(perk?.perkHash || perk?.hash);
  if (!Number.isFinite(perkHash)) return null;

  const popularity = Number(perk?.popularity ?? perk?.percent ?? perk?.usagePercent);
  if (!Number.isFinite(popularity) || popularity <= 0) return null;

  const rawSocketIndex = column?.socketIndex ?? (
    Number.isFinite(Number(column?.columnIndex)) ? Number(column.columnIndex) + 1 : undefined
  );
  const socketIndex = Number(rawSocketIndex);
  return {
    id: String(perk?.id || `lightgg-individual-${weaponHash}-${Number.isFinite(socketIndex) ? socketIndex : 'x'}-${perkHash}`),
    mode: normalizeMode(perk?.mode || column?.mode),
    label: String(perk?.label || `社区热度 ${formatPercent(popularity)}`),
    source: LIGHTGG_SOURCE,
    sourceUrl: String(perk?.sourceUrl || parent?.sourceUrl || lightggItemUrl(weaponHash)),
    confidence: 'community',
    notes: String(perk?.notes || `Light.gg 单 Perk 热度 ${formatPercent(popularity)}`),
    sockets: [{
      socketIndex: Number.isFinite(socketIndex) ? socketIndex : 0,
      label: String(column?.label || ''),
      role: 'community-popularity',
      perkHashes: [perkHash]
    }]
  };
}

function normalizeRecommendation(roll, weaponHash, parent) {
  const sockets = normalizeSockets(roll?.sockets || []);
  if (!sockets.length) return null;
  return {
    id: String(roll?.id || `lightgg-${weaponHash}-${sockets.map((socket) => socket.perkHashes.join('_')).join('-')}`),
    mode: normalizeMode(roll?.mode),
    label: String(roll?.label || roll?.name || '社区推荐'),
    source: LIGHTGG_SOURCE,
    sourceUrl: String(roll?.sourceUrl || parent?.sourceUrl || lightggItemUrl(weaponHash)),
    confidence: String(roll?.confidence || 'community'),
    notes: String(roll?.notes || communityNote(roll)),
    sockets
  };
}

function normalizeSockets(sockets) {
  return sockets
    .map((socket) => {
      const perkHashes = (socket?.perkHashes || [socket?.perkHash])
        .map((hash) => Number(hash))
        .filter(Number.isFinite);
      if (!perkHashes.length) return null;
      return {
        socketIndex: Number(socket?.socketIndex || 0),
        label: String(socket?.label || ''),
        role: String(socket?.role || 'community'),
        perkHashes
      };
    })
    .filter(Boolean);
}

function normalizeMode(mode) {
  const value = String(mode || '').toLowerCase();
  if (value === 'pve' || value === 'pvp') return value;
  return 'general';
}

function communityNote(value) {
  const popularity = Number(value?.popularity ?? value?.percent ?? value?.usagePercent);
  if (Number.isFinite(popularity) && popularity > 0) {
    return `Light.gg 社区样本热度 ${formatPercent(popularity)}`;
  }
  return '来自 Light.gg 社区流行度数据。';
}

function formatPercent(value) {
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
}

function lightggItemUrl(hash) {
  return `https://www.light.gg/db/items/${hash}/`;
}
