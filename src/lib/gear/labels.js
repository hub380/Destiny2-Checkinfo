import { BUNGIE_BASE_URL } from './constants.js';
import {
  WEAPON_CATEGORY,
  ARMOR_CATEGORY,
  KINETIC_WEAPON,
  ENERGY_WEAPON,
  POWER_WEAPON,
  HELMET,
  ARMS,
  CHEST,
  LEGS,
  CLASS_ITEM,
  ITEM_TYPE_ARMOR,
  ITEM_TYPE_WEAPON,
  TRAIT_CATEGORY,
  ADEPT_SUFFIX
} from './constants.js';
import { cleanText, normalizeText } from './utils.js';

export function normalizeGearKind(kind) {
  const value = String(kind || '').toLowerCase();
  if (['weapon', 'armor', 'perk', 'all'].includes(value)) return value;
  return 'all';
}

export function isWeapon(definition) {
  return Number(definition.itemType) === ITEM_TYPE_WEAPON && hasCategory(definition, WEAPON_CATEGORY);
}

export function isArmor(definition) {
  return Number(definition.itemType) === ITEM_TYPE_ARMOR && hasCategory(definition, ARMOR_CATEGORY);
}

export function isTraitPlug(definition) {
  return (
    hasCategory(definition, TRAIT_CATEGORY) ||
    String(definition.itemTypeDisplayName || '').includes('特性') ||
    String(definition.itemTypeDisplayName || '').toLowerCase().includes('trait')
  );
}

export function isEnhancedPerk(definition) {
  return String(definition.itemTypeDisplayName || '').includes('强化') || displayDescription(definition).includes('持续时间延长');
}

export function ammoLabel(definition) {
  if (hasCategory(definition, KINETIC_WEAPON)) return '动能槽';
  if (hasCategory(definition, ENERGY_WEAPON)) return '能量槽';
  if (hasCategory(definition, POWER_WEAPON)) return '威能槽';
  return '';
}

export function elementLabel(definition, damageTypes) {
  return (definition.damageTypeHashes || [])
    .map((hash) => displayName(damageTypes[String(hash)]))
    .filter(Boolean)
    .join(', ');
}

export function armorSlotLabel(definition) {
  if (hasCategory(definition, HELMET)) return '头盔';
  if (hasCategory(definition, ARMS)) return '臂铠';
  if (hasCategory(definition, CHEST)) return '胸甲';
  if (hasCategory(definition, LEGS)) return '腿甲';
  if (hasCategory(definition, CLASS_ITEM)) return '职业物品';
  return definition.itemTypeDisplayName || '护甲';
}

export function classTypeLabel(value) {
  const number = Number(value);
  if (number === 0) return '泰坦';
  if (number === 1) return '猎人';
  if (number === 2) return '术士';
  return '通用';
}

export function isAdept(name) {
  return name.includes(ADEPT_SUFFIX) || /\(Adept\)/i.test(name);
}

export function baseWeaponName(name) {
  return name.replace(ADEPT_SUFFIX, '').replace(/\s*\(Adept\)$/i, '');
}

export function hasCategory(definition, hash) {
  return Array.isArray(definition.itemCategoryHashes) && definition.itemCategoryHashes.includes(hash);
}

export function displayName(definition) {
  return cleanText(definition?.displayProperties?.name);
}

export function displayDescription(definition) {
  return cleanText(definition?.displayProperties?.description || definition?.flavorText);
}

export function iconUrl(definition) {
  const icon = definition?.displayProperties?.icon || definition?.iconImage || '';
  return imageUrl(icon);
}

export function imageUrl(value) {
  const path = String(value || '');
  if (!path) return '';
  return path.startsWith('http') ? path : `${BUNGIE_BASE_URL}${path}`;
}

export function makeSearchText(item) {
  return normalizeText([item.name, item.type, item.weaponType, item.ammo, item.element, item.slot, item.className, item.tier, item.description, item.source, sourceSearchText(item), item.hash].filter(Boolean).join(' '));
}

export function sourceSearchText(item) {
  const hints = Array.isArray(item?.sourceHints) ? item.sourceHints : [];
  return normalizeText(
    hints
      .flatMap((hint) => [hint?.text, hint?.description, hint?.label])
      .filter(Boolean)
      .join(' ')
  );
}
