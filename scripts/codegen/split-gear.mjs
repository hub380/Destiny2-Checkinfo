import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const srcPath = path.join(rootDir, 'src', 'lib', 'gear', '.gear-core.source.js');
const outDir = path.join(rootDir, 'src', 'lib', 'gear');

const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function stripExports(code) {
  return code.replace(/^export /gm, '');
}

function exportFunctions(code, names) {
  let out = code;
  for (const name of names) {
    out = out.replace(new RegExp(`^(async )?function ${name}\\(`, 'm'), (match) => `export ${match}`);
  }
  return out;
}

const constantsJs = slice(1, 17).replace(/^const /gm, 'export const ');

const utilsJs = `import { cleanText as baseCleanText } from '../utils/index.js';
import { httpError } from '../http/index.js';

export { httpError };

export function cleanText(value) {
  return baseCleanText(value);
}

${exportFunctions(stripExports(slice(1107, 1111)), ['normalizeText'])}
${exportFunctions(stripExports(slice(1120, 1139)), ['clampNumber', 'uniqueByHash', 'uniqueNumbers'])}

export function requireApiKey(deps) {
  if (!deps?.apiKey) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询装备数据');
  }
}
`;

const bungieFetchJs = `import { BUNGIE_BASE_URL } from './constants.js';
import { httpError } from './utils.js';

${exportFunctions(stripExports(slice(766, 806)), ['bungieFetchJson'])}
`;

const labelsJs = `import { BUNGIE_BASE_URL } from './constants.js';
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

${exportFunctions(stripExports(slice(1011, 1105)), [
  'normalizeGearKind',
  'isWeapon',
  'isArmor',
  'isTraitPlug',
  'isEnhancedPerk',
  'ammoLabel',
  'elementLabel',
  'armorSlotLabel',
  'classTypeLabel',
  'isAdept',
  'baseWeaponName',
  'hasCategory',
  'displayName',
  'displayDescription',
  'iconUrl',
  'imageUrl',
  'makeSearchText',
  'sourceSearchText'
])}
`;

const sourcesJs = `import { cleanText } from './utils.js';
import { displayName, displayDescription, imageUrl } from './labels.js';

${exportFunctions(stripExports(slice(316, 442)), [
  'isPatternRecordDescription',
  'cleanSourceLabel',
  'cleanAcquisitionSource',
  'isNonAcquisitionSourceText',
  'buildSourceHints',
  'addSourceHint',
  'rewardSourceHashes',
  'vendorSourceRefs'
])}
`;

const factoriesJs = `import { EMPTY_TRAIT_SOCKET } from './constants.js';
import { cleanText } from './utils.js';
import {
  displayName,
  displayDescription,
  iconUrl,
  imageUrl,
  isWeapon,
  isArmor,
  isTraitPlug,
  isEnhancedPerk,
  ammoLabel,
  elementLabel,
  armorSlotLabel,
  classTypeLabel,
  isAdept,
  baseWeaponName,
  hasCategory,
  makeSearchText
} from './labels.js';
import { buildSourceHints } from './sources.js';

${exportFunctions(stripExports(slice(444, 764)), [
  'makeWeaponItem',
  'makeArmorItem',
  'makePerkItem',
  'makeWeaponRecord',
  'makeArmorRecord',
  'resolveSocketPerks',
  'addWeaponPlug',
  'isWeaponSocketPlug',
  'plugHashesForSocket',
  'makeItemSetMap',
  'armorIntrinsicPerks',
  'isArmorIntrinsicPlug',
  'formatStats',
  'formatInvestmentStats',
  'diffInvestmentStats',
  'perkPairKey',
  'basePerkType',
  'weaponSocketLabel'
])}
`;

const buildIndexJs = `import { GEAR_INDEX_VERSION } from './constants.js';
import { httpError } from './utils.js';
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

${exportFunctions(stripExports(slice(254, 314)), ['makeCraftingInfoMap', 'makeCraftableRecords'])}

${exportFunctions(stripExports(slice(186, 252)), ['buildGearIndex'])}
`;

const indexCacheJs = `import { GEAR_INDEX_VERSION } from './constants.js';
import { buildGearIndex } from './build-index.js';

${exportFunctions(stripExports(slice(168, 184)), ['getGearIndex', 'loadStaticGearIndex'])}
`;

const searchJs = `import { normalizeText } from './utils.js';
import { sourceSearchText } from './labels.js';

${exportFunctions(stripExports(slice(808, 881)), [
  'compareGearItems',
  'scoreGearItem',
  'sourceMatchRank',
  'nameContainsRank',
  'gearKindRank',
  'armorSetBonusHashSet',
  'armorSetBonusRank',
  'hasArmorSetBonus',
  'hasUsableSetBonus',
  'enrichGearSearchItem'
])}
`;

const publicJs = `import { diffInvestmentStats } from './factories.js';
import { perkMap } from './perk-map.js';
import { resolveSocketPerks, perkPairKey } from './factories.js';

${exportFunctions(stripExports(slice(883, 970)), [
  'publicGearItem',
  'publicGearDetail',
  'publicArmorRecord',
  'publicWeaponRecord',
  'publicWeaponSockets',
  'publicSocketPerks',
  'publicPerkRef',
  'publicEnhancedPerkRef'
])}
`;

const perkMapJs = `export function perkMap(index) {
  return new Map([
    ...index.items.filter((item) => item.kind === 'perk').map((item) => [item.hash, item]),
    ...(index.weaponPlugs || []).map((item) => [item.hash, item])
  ]);
}
`;

const handlersJs = `import { cleanText, clampNumber, httpError, requireApiKey } from './utils.js';
import { normalizeText } from './utils.js';
import { getGearIndex } from './index-cache.js';
import {
  compareGearItems,
  scoreGearItem,
  armorSetBonusHashSet,
  enrichGearSearchItem
} from './search.js';
import { publicGearItem, publicGearDetail, publicWeaponSockets, publicPerkRef } from './public.js';
import { perkMap } from './perk-map.js';
import { uniqueByHash } from './utils.js';

${exportFunctions(stripExports(slice(19, 166)), ['getGearSearch', 'getGearItem', 'getPerkWeapons'])}
`;

const indexJs = `export { getGearSearch, getGearItem, getPerkWeapons } from './handlers.js';
export { buildGearIndex } from './build-index.js';
export { loadR2GearIndex, getGearCacheStatus, runGearCacheCheck } from './cache.js';
export { workerGearDeps } from './worker-deps.js';
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'constants.js'), constantsJs);
fs.writeFileSync(path.join(outDir, 'utils.js'), utilsJs);
fs.writeFileSync(path.join(outDir, 'bungie-fetch.js'), bungieFetchJs);
fs.writeFileSync(path.join(outDir, 'labels.js'), labelsJs);
fs.writeFileSync(path.join(outDir, 'sources.js'), sourcesJs);
fs.writeFileSync(path.join(outDir, 'factories.js'), factoriesJs);
fs.writeFileSync(path.join(outDir, 'build-index.js'), buildIndexJs);
fs.writeFileSync(path.join(outDir, 'index-cache.js'), indexCacheJs);
fs.writeFileSync(path.join(outDir, 'search.js'), searchJs);
fs.writeFileSync(path.join(outDir, 'perk-map.js'), perkMapJs);
fs.writeFileSync(path.join(outDir, 'public.js'), publicJs);
fs.writeFileSync(path.join(outDir, 'handlers.js'), handlersJs);
fs.writeFileSync(path.join(outDir, 'index.js'), indexJs);

console.log('Split gear modules into', outDir);
