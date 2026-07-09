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

const TRADITIONAL_TO_SIMPLIFIED = new Map(
  Object.entries({
    傳: '传',
    儀: '仪',
    優: '优',
    兌: '兑',
    劍: '剑',
    動: '动',
    勁: '劲',
    勳: '勋',
    匯: '汇',
    區: '区',
    單: '单',
    器: '器',
    團: '团',
    場: '场',
    增: '增',
    壓: '压',
    奧: '奥',
    寶: '宝',
    導: '导',
    屬: '属',
    峽: '峡',
    彈: '弹',
    復: '复',
    循: '循',
    戰: '战',
    擊: '击',
    擋: '挡',
    擴: '扩',
    擲: '掷',
    效: '效',
    數: '数',
    敵: '敌',
    斷: '断',
    時: '时',
    會: '会',
    換: '换',
    槍: '枪',
    標: '标',
    機: '机',
    殺: '杀',
    氣: '气',
    沖: '冲',
    淵: '渊',
    災: '灾',
    為: '为',
    無: '无',
    燈: '灯',
    爐: '炉',
    獎: '奖',
    環: '环',
    異: '异',
    發: '发',
    盡: '尽',
    監: '监',
    眾: '众',
    碎: '碎',
    禦: '御',
    稱: '称',
    穩: '稳',
    窮: '穷',
    範: '范',
    級: '级',
    終: '终',
    經: '经',
    維: '维',
    線: '线',
    練: '练',
    縛: '缚',
    總: '总',
    聖: '圣',
    聲: '声',
    職: '职',
    膽: '胆',
    舊: '旧',
    處: '处',
    號: '号',
    術: '术',
    裝: '装',
    視: '视',
    觸: '触',
    誘: '诱',
    調: '调',
    護: '护',
    變: '变',
    負: '负',
    賞: '赏',
    賽: '赛',
    起: '起',
    較: '较',
    載: '载',
    輪: '轮',
    轉: '转',
    進: '进',
    遠: '远',
    邊: '边',
    鈕: '钮',
    鋒: '锋',
    鍛: '锻',
    鎖: '锁',
    鐵: '铁',
    門: '门',
    關: '关',
    隊: '队',
    雙: '双',
    電: '电',
    靈: '灵',
    頭: '头',
    類: '类',
    顯: '显',
    餌: '饵',
    體: '体',
    鬥: '斗',
    魂: '魂',
    魔: '魔',
    黃: '黄',
    點: '点'
  })
);

export function simplifiedChineseAlias(value) {
  const text = cleanText(value);
  if (!text) return '';
  let changed = false;
  const output = Array.from(text, (char) => {
    const mapped = TRADITIONAL_TO_SIMPLIFIED.get(char);
    if (mapped) changed = true;
    return mapped || char;
  }).join('');
  return changed ? output : '';
}

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
  return normalizeText([
    item.name,
    item.enName,
    item.chtName,
    simplifiedChineseAlias(item.chtName),
    item.type,
    item.weaponType,
    item.ammo,
    item.element,
    item.slot,
    item.className,
    item.tier,
    item.description,
    item.source,
    sourceSearchText(item),
    item.hash
  ].filter(Boolean).join(' '));
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
