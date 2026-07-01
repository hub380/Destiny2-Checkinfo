import { GEAR_INDEX_VERSION } from './constants.js';
import { httpError, cleanText } from './utils.js';
import { bungieFetchJson } from './bungie-fetch.js';
import {
  displayName,
  displayDescription,
  iconUrl,
  imageUrl,
  isWeapon,
  isArmor,
  isTraitPlug
} from './labels.js';
import { isPatternRecordDescription, cleanSourceLabel } from './sources.js';
import {
  makeWeaponItem,
  makeArmorItem,
  makePerkItem,
  makeWeaponRecord,
  makeArmorRecord,
  makeItemSetMap
} from './factories.js';

export function makeCraftingInfoMap(items, collectibles, recordDefs) {
  const patternRecords = new Map();
  for (const record of Object.values(recordDefs || {})) {
    const name = displayName(record);
    const description = cleanText(displayDescription(record)).toLowerCase();
    if (!name || !Array.isArray(record.objectiveHashes) || !record.objectiveHashes.length) continue;
    if (!isPatternRecordDescription(description)) continue;
    if (!patternRecords.has(name)) {
      patternRecords.set(name, {
        hash: Number(record.hash),
        objectiveHash: Number(record.objectiveHashes[0])
      });
    }
  }

  const output = new Map();
  for (const definition of Object.values(items || {})) {
    if (!definition || definition.redacted || !definition.crafting?.outputItemHash) continue;
    const hash = Number(definition.hash);
    const name = displayName(definition);
    const outputDefinition = items[String(definition.crafting.outputItemHash)] || definition;
    const collectibleHash = Number(outputDefinition.collectibleHash || definition.collectibleHash || 0);
    const collectible = collectibleHash ? collectibles?.[String(collectibleHash)] : null;
    const patternRecord = patternRecords.get(name) || patternRecords.get(displayName(outputDefinition)) || null;
    output.set(hash, {
      source: cleanSourceLabel(collectible?.sourceString) || cleanSourceLabel(outputDefinition.displaySource),
      sourceHash: Number(collectible?.sourceHash || 0),
      patternRecordHash: patternRecord?.hash || 0,
      patternObjectiveHash: patternRecord?.objectiveHash || 0,
      outputItemHash: Number(definition.crafting.outputItemHash || 0),
      outputCollectibleHash: collectibleHash,
      watermark: imageUrl(definition.iconWatermark || outputDefinition.iconWatermark || '')
    });
  }
  return output;
}

export function makeCraftableRecords(items, craftingInfoByHash) {
  return Array.from(craftingInfoByHash.entries())
    .map(([hash, craftingInfo]) => {
      const definition = items[String(hash)];
      if (!definition || definition.redacted) return null;
      return {
        kind: 'craftable',
        hash,
        name: displayName(definition),
        icon: iconUrl(definition),
        type: definition.itemTypeDisplayName || '',
        weaponType: definition.itemTypeDisplayName || '',
        tier: definition.inventory?.tierTypeName || '',
        source: craftingInfo.source,
        sourceHash: craftingInfo.sourceHash,
        patternRecordHash: craftingInfo.patternRecordHash,
        patternObjectiveHash: craftingInfo.patternObjectiveHash,
        outputItemHash: craftingInfo.outputItemHash,
        outputCollectibleHash: craftingInfo.outputCollectibleHash,
        watermark: craftingInfo.watermark
      };
    })
    .filter(Boolean);
}

export async function buildGearIndex(deps) {
  const locale = deps.locale || 'zh-chs';
  const manifest = await bungieFetchJson('/Platform/Destiny2/Manifest/', deps);
  const paths =
    manifest.Response?.jsonWorldComponentContentPaths?.[locale] ||
    manifest.Response?.jsonWorldComponentContentPaths?.['zh-chs'] ||
    manifest.Response?.jsonWorldComponentContentPaths?.en;

  if (!paths?.DestinyInventoryItemDefinition || !paths?.DestinyPlugSetDefinition) {
    throw httpError(502, 'MANIFEST_PATH_MISSING', 'Bungie Manifest 缺少装备定义表');
  }

  const [items, plugSets, damageTypes, statDefs, itemSets, sandboxPerks, collectibles, recordDefs, rewardSources, vendors, objectiveDefs] = await Promise.all([
    bungieFetchJson(paths.DestinyInventoryItemDefinition, deps),
    bungieFetchJson(paths.DestinyPlugSetDefinition, deps),
    paths.DestinyDamageTypeDefinition ? bungieFetchJson(paths.DestinyDamageTypeDefinition, deps) : Promise.resolve({}),
    paths.DestinyStatDefinition ? bungieFetchJson(paths.DestinyStatDefinition, deps) : Promise.resolve({}),
    paths.DestinyEquipableItemSetDefinition ? bungieFetchJson(paths.DestinyEquipableItemSetDefinition, deps) : Promise.resolve({}),
    paths.DestinySandboxPerkDefinition ? bungieFetchJson(paths.DestinySandboxPerkDefinition, deps) : Promise.resolve({}),
    paths.DestinyCollectibleDefinition ? bungieFetchJson(paths.DestinyCollectibleDefinition, deps) : Promise.resolve({}),
    paths.DestinyRecordDefinition ? bungieFetchJson(paths.DestinyRecordDefinition, deps) : Promise.resolve({}),
    paths.DestinyRewardSourceDefinition ? bungieFetchJson(paths.DestinyRewardSourceDefinition, deps) : Promise.resolve({}),
    paths.DestinyVendorDefinition ? bungieFetchJson(paths.DestinyVendorDefinition, deps) : Promise.resolve({}),
    paths.DestinyObjectiveDefinition ? bungieFetchJson(paths.DestinyObjectiveDefinition, deps) : Promise.resolve({})
  ]);

  const records = [];
  const weapons = [];
  const armors = [];
  const weaponPlugs = new Map();
  const itemSetByItemHash = makeItemSetMap(itemSets, sandboxPerks);
  const craftingInfoByHash = makeCraftingInfoMap(items, collectibles, recordDefs);
  const craftables = makeCraftableRecords(items, craftingInfoByHash);

  for (const definition of Object.values(items)) {
    if (!definition || definition.redacted) continue;

    if (isWeapon(definition)) {
      const item = makeWeaponItem(definition, damageTypes, craftingInfoByHash, collectibles, rewardSources, vendors);
      records.push(item);
      weapons.push(makeWeaponRecord(definition, item, items, plugSets, statDefs, weaponPlugs, craftingInfoByHash, sandboxPerks, objectiveDefs));
      continue;
    }

    if (isArmor(definition)) {
      const item = makeArmorItem(definition, itemSetByItemHash, collectibles, rewardSources, vendors);
      records.push(item);
      armors.push(makeArmorRecord(definition, item, items, itemSetByItemHash, statDefs));
      continue;
    }

    if (isTraitPlug(definition)) {
      records.push(makePerkItem(definition, statDefs));
    }
  }

  return {
    indexVersion: GEAR_INDEX_VERSION,
    locale,
    manifestVersion: manifest.Response?.version || null,
    builtAt: new Date().toISOString(),
    items: records,
    weapons,
    armors,
    craftables,
    weaponPlugs: Array.from(weaponPlugs.values())
  };
}
