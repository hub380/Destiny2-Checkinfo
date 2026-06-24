import { normalizeText } from './utils.js';
import { sourceSearchText } from './labels.js';

export function compareGearItems(a, b, normalizedQuery, rawQuery, armorSetBonusHashes) {
  return (
    scoreGearItem(a, normalizedQuery, rawQuery) - scoreGearItem(b, normalizedQuery, rawQuery) ||
    sourceMatchRank(a, normalizedQuery) - sourceMatchRank(b, normalizedQuery) ||
    nameContainsRank(a, normalizedQuery) - nameContainsRank(b, normalizedQuery) ||
    gearKindRank(a) - gearKindRank(b) ||
    armorSetBonusRank(a, armorSetBonusHashes) - armorSetBonusRank(b, armorSetBonusHashes) ||
    a.name.localeCompare(b.name, 'zh-CN')
  );
}

export function scoreGearItem(item, normalizedQuery, rawQuery) {
  if (String(item.hash) === rawQuery) return 0;
  if (normalizeText(item.name) === normalizedQuery) return 1;
  if (normalizeText(item.name).startsWith(normalizedQuery)) return 2;
  return 3;
}

export function sourceMatchRank(item, normalizedQuery) {
  if (!normalizedQuery) return 1;
  const text = sourceSearchText(item);
  if (!text) return 1;
  return text.includes(normalizedQuery) ? 0 : 1;
}

export function nameContainsRank(item, normalizedQuery) {
  if (!normalizedQuery) return 1;
  return normalizeText(item?.name || '').includes(normalizedQuery) ? 0 : 1;
}

export function gearKindRank(item) {
  if (item.kind === 'weapon') return 0;
  if (item.kind === 'armor') return 1;
  if (item.kind === 'perk') return 2;
  return 3;
}

export function armorSetBonusHashSet(index) {
  return new Set(
    (index.armors || [])
      .filter((armor) => hasUsableSetBonus(armor.setBonus))
      .map((armor) => Number(armor.hash))
      .filter(Number.isFinite)
  );
}

export function armorSetBonusRank(item, armorSetBonusHashes) {
  if (item.kind !== 'armor') return 0;
  return hasArmorSetBonus(item, armorSetBonusHashes) ? 0 : 1;
}

export function hasArmorSetBonus(item, armorSetBonusHashes) {
  return Boolean(item?.hasSetBonus || armorSetBonusHashes.has(Number(item?.hash)));
}

export function hasUsableSetBonus(setBonus) {
  return Boolean(setBonus && Array.isArray(setBonus.perks) && setBonus.perks.length);
}

export function enrichGearSearchItem(item, index, armorSetBonusHashes) {
  if (item.kind !== 'armor' || item.hasSetBonus || !armorSetBonusHashes.has(Number(item.hash))) return item;
  const armor = (index.armors || []).find((entry) => Number(entry.hash) === Number(item.hash));
  if (!hasUsableSetBonus(armor?.setBonus)) {
    return {
      ...item,
      hasSetBonus: true
    };
  }
  return {
    ...item,
    hasSetBonus: true,
    setBonusName: armor.setBonus.name || ''
  };
}
