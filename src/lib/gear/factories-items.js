import { cleanText } from './utils.js';
import { hasUsableSetBonus } from './search.js';
import {
  displayName,
  displayDescription,
  iconUrl,
  isEnhancedPerk,
  ammoLabel,
  elementLabel,
  armorSlotLabel,
  classTypeLabel,
  isAdept,
  makeSearchText
} from './labels.js';
import { buildSourceHints } from './sources.js';

export function makeWeaponItem(definition, damageTypes, craftingInfoByHash = new Map(), collectibles = {}, rewardSources = {}, vendors = {}) {
  const ammo = ammoLabel(definition);
  const element = elementLabel(definition, damageTypes);
  const craftingInfo = craftingInfoByHash.get(Number(definition.hash));
  const sourceHints = buildSourceHints(definition, collectibles, rewardSources, vendors, craftingInfo);
  const item = {
    kind: 'weapon',
    hash: Number(definition.hash),
    name: displayName(definition),
    icon: iconUrl(definition),
    type: definition.itemTypeDisplayName || '武器',
    weaponType: definition.itemTypeDisplayName || '',
    ammo,
    element,
    tier: definition.inventory?.tierTypeName || '',
    adept: isAdept(displayName(definition)),
    description: cleanText(displayDescription(definition)),
    sourceHints
  };
  if (craftingInfo) {
    Object.assign(item, {
      craftable: true,
      source: craftingInfo.source || sourceHints[0]?.text || '',
      sourceHash: craftingInfo.sourceHash,
      patternRecordHash: craftingInfo.patternRecordHash,
      patternObjectiveHash: craftingInfo.patternObjectiveHash,
      outputItemHash: craftingInfo.outputItemHash,
      outputCollectibleHash: craftingInfo.outputCollectibleHash,
      watermark: craftingInfo.watermark
    });
  }
  item.searchText = makeSearchText(item);
  return item;
}

export function makeArmorItem(definition, itemSetByItemHash = new Map(), collectibles = {}, rewardSources = {}, vendors = {}) {
  const setBonus = itemSetByItemHash.get(Number(definition.hash)) || null;
  const sourceHints = buildSourceHints(definition, collectibles, rewardSources, vendors, null);
  const item = {
    kind: 'armor',
    hash: Number(definition.hash),
    name: displayName(definition),
    icon: iconUrl(definition),
    type: definition.itemTypeDisplayName || '护甲',
    slot: armorSlotLabel(definition),
    className: classTypeLabel(definition.classType),
    tier: definition.inventory?.tierTypeName || '',
    description: cleanText(displayDescription(definition)),
    hasSetBonus: hasUsableSetBonus(setBonus),
    setBonusName: setBonus?.name || '',
    sourceHints
  };
  item.searchText = makeSearchText(item);
  return item;
}

export function makePerkItem(definition, statDefs) {
  const item = {
    kind: 'perk',
    hash: Number(definition.hash),
    name: displayName(definition),
    icon: iconUrl(definition),
    type: definition.itemTypeDisplayName || '特性',
    enhanced: isEnhancedPerk(definition),
    description: cleanText(displayDescription(definition)),
    category: definition.plug?.plugCategoryIdentifier || '',
    stats: formatInvestmentStats(definition, statDefs)
  };
  item.searchText = makeSearchText(item);
  return item;
}

function formatInvestmentStats(definition, statDefs) {
  return (definition.investmentStats || [])
    .map((stat) => {
      const statDef = statDefs[String(stat.statTypeHash)] || {};
      const name = displayName(statDef);
      const value = Number(stat.value || 0);
      return {
        hash: Number(stat.statTypeHash),
        name,
        value,
        conditionallyActive: Boolean(stat.isConditionallyActive)
      };
    })
    .filter((stat) => stat.name && stat.value !== 0);
}
