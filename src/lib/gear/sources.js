import { cleanText } from './utils.js';
import { displayName, displayDescription } from './labels.js';

export function isPatternRecordDescription(description) {
  if (!description) return false;
  return (
    (description.includes('深视') && description.includes('模式')) ||
    (description.includes('deepsight') && description.includes('pattern'))
  );
}

export function cleanSourceLabel(value) {
  return cleanText(value)
    .replace(/^来源[:：]\s*/i, '')
    .replace(/^source[:：]\s*/i, '')
    .trim();
}

export function cleanAcquisitionSource(value) {
  const text = cleanSourceLabel(value);
  if (!text || isNonAcquisitionSourceText(text)) return '';
  return text;
}

export function isNonAcquisitionSourceText(value) {
  const text = String(value || '').toLowerCase();
  return (
    text.includes('随机特性') ||
    text.includes('无法从收藏品再次获取') ||
    text.includes('random perks') ||
    text.includes('cannot be reacquired from collections') ||
    /^v\d+\s+[a-z0-9_-]+/i.test(text)
  );
}

export function buildSourceHints(definition, collectibles, rewardSources, vendors, craftingInfo) {
  const hints = [];
  const collectibleHash = Number(definition.collectibleHash || craftingInfo?.outputCollectibleHash || 0);
  const collectible = collectibleHash ? collectibles?.[String(collectibleHash)] : null;

  addSourceHint(hints, {
    kind: 'crafting',
    label: '锻造配方',
    text: cleanAcquisitionSource(craftingInfo?.source),
    hash: craftingInfo?.sourceHash || 0,
    confidence: 'hint'
  });

  addSourceHint(hints, {
    kind: 'collectible',
    label: '收藏品来源',
    text: cleanAcquisitionSource(collectible?.sourceString),
    hash: Number(collectible?.sourceHash || 0),
    confidence: 'hint'
  });

  addSourceHint(hints, {
    kind: 'displaySource',
    label: '物品来源',
    text: cleanAcquisitionSource(definition.displaySource),
    hash: 0,
    confidence: 'hint'
  });

  for (const hash of rewardSourceHashes(definition)) {
    const rewardSource = rewardSources?.[String(hash)];
    const name = cleanSourceLabel(displayName(rewardSource));
    const description = cleanSourceLabel(displayDescription(rewardSource));
    addSourceHint(hints, {
      kind: 'rewardSource',
      label: '奖励来源',
      text: name || description,
      description: description && description !== name ? description : '',
      hash,
      confidence: 'hint'
    });
  }

  for (const source of vendorSourceRefs(definition)) {
    const vendor = vendors?.[String(source.vendorHash)];
    addSourceHint(hints, {
      kind: 'vendor',
      label: 'Vendor 来源',
      text: cleanSourceLabel(displayName(vendor)) || `Vendor ${source.vendorHash}`,
      hash: source.vendorHash,
      vendorItemIndexes: source.vendorItemIndexes,
      confidence: 'hint'
    });
  }

  return hints.map(({ key: _key, ...hint }) => hint);
}

export function addSourceHint(hints, hint) {
  const text = cleanSourceLabel(hint?.text);
  if (!text) return;
  const key = [hint.kind || '', text.toLowerCase(), hint.hash || 0].join('|');
  if (hints.some((entry) => entry.key === key || entry.text === text)) return;
  hints.push({
    kind: hint.kind || 'unknown',
    label: hint.label || '来源提示',
    text,
    description: cleanText(hint.description),
    hash: Number(hint.hash || 0),
    confidence: hint.confidence || 'hint',
    vendorItemIndexes: Array.isArray(hint.vendorItemIndexes) ? hint.vendorItemIndexes : [],
    key
  });
}

export function rewardSourceHashes(definition) {
  const hashes = new Set();
  for (const hash of definition.sourceData?.sourceHashes || []) {
    if (hash) hashes.add(Number(hash));
  }
  for (const source of definition.sourceData?.sources || []) {
    if (source?.sourceHash) hashes.add(Number(source.sourceHash));
    if (source?.rewardSourceHash) hashes.add(Number(source.rewardSourceHash));
  }
  return Array.from(hashes).filter(Boolean);
}

export function vendorSourceRefs(definition) {
  return [...(definition.sourceData?.vendorSources || []), ...(definition.vendorSources || [])]
    .map((source) => ({
      vendorHash: Number(source?.vendorHash || 0),
      vendorItemIndexes: Array.isArray(source?.vendorItemIndexes) ? source.vendorItemIndexes.map(Number).filter(Number.isFinite) : []
    }))
    .filter((source) => source.vendorHash);
}
