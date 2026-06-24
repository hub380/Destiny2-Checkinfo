import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const srcPath = path.join(rootDir, 'src', 'lib', 'destiny-handlers.source.js');
const outDir = path.join(rootDir, 'src', 'lib', 'destiny');

const rawLines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);
const lines = rawLines.slice(33);

function slice(start, end) {
  return lines.slice(start - 34, end - 33).join('\n');
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

function normalizeCaches(code) {
  return code
    .replace(/\bACTIVITY_INDEX_CACHE\b/g, 'activityIndexCache')
    .replace(/\bACTIVITY_DEFINITION_CACHE\b/g, 'activityDefinitionCache')
    .replace(/\bITEM_DEFINITION_CACHE\b/g, 'itemDefinitionCache');
}

const stateJs = `import { CACHE_VERSION } from '../shared/index.js';

export const activityIndexCache = new Map();
export const activityDefinitionCache = new Map();
export const itemDefinitionCache = new Map();
export { CACHE_VERSION };
`;

const privacyJs = `export function hasFailures(value) {
  return Array.isArray(value) && value.length > 0;
}

export function privacyLabel(value) {
  const number = Number(value);
  if (number === 1) return 'public';
  if (number === 2) return 'private';
  return 'none';
}
`;

const sharedImports = `import { bungieFetch } from '../bungie/index.js';
import { positiveNumber } from '../http/index.js';
`;
const sharedJs =
  sharedImports +
  exportFunctions(
    normalizeCaches(stripExports(slice(670, 728))),
    [
      'fetchCharacterRefs',
      'normalizeCharacterRefs',
      'attachEndgameToCareer',
      'normalizeEndgameModes',
      'historyPageLimit',
      'historyPageSize',
      'buildEndgameStatsPatch'
    ]
  );

const summaryImports = `import { cleanText, parseBungieName } from '../utils/index.js';
import {
  selectMembership,
  displayMembershipName,
  membershipTypeName,
  bungieAssetUrl,
  className,
  raceName,
  genderName
} from '../bungie/index.js';
import { percentStat } from '../bungie/index.js';
import { httpError, positiveNumber } from '../http/index.js';
import { bungieFetch } from '../bungie/index.js';
import { getWorkerCachedJson } from '../cache/index.js';
import { summaryCacheTtlSeconds } from '../cache/index.js';
import { CACHE_VERSION } from '../shared/index.js';
`;
const summaryBody = stripExports(
  [
    slice(49, 91),
    slice(250, 331),
    slice(420, 520),
    slice(983, 1039),
    slice(1507, 1550),
    slice(1553, 1587),
    slice(1589, 1620)
  ].join('\n\n')
);
const summaryJs =
  summaryImports +
  exportFunctions(summaryBody, [
    'getDestinyPlayerSearch',
    'getPublicCareerSummaryByMembership',
    'fetchPublicProfileByMembership',
    'parsedNameFromMembership',
    'searchBungiePlayersByPrefix',
    'getDestinySummary',
    'summarizeCareer',
    'findModeBucket',
    'normalizeStatModeKey',
    'pickEndgameStats',
    'pickStats',
    'decimalStat',
    'ratioStat',
    'secondsDisplayStat',
    'stat',
    'normalizePlayerSearchResult'
  ]);

const targetsImports = `import { getDestinySummary } from './summary.js';
import { fetchCharacterRefs, normalizeCharacterRefs } from './shared.js';
`;
const targetsJs =
  targetsImports +
  exportFunctions(stripExports(slice(624, 668)), ['resolveDetailsTarget', 'resolveEndgameTarget']);

const careerImports = `import { getDestinySummary } from './summary.js';
import { getDestinyEndgame } from './endgame.js';
import { attachEndgameToCareer } from './shared.js';
`;
const careerJs =
  careerImports + exportFunctions(stripExports(slice(35, 47)), ['getDestinyCareer']);

const activitiesImports = `import { cleanText } from '../utils/index.js';
import { bungieFetch } from '../bungie/index.js';
import { httpError } from '../http/index.js';
import { getWorkerCachedJson, putWorkerCachedJson, waitForCacheWrite } from '../cache/index.js';
import {
  activityDefinitionCacheTtlSeconds,
  activityDefinitionConcurrency
} from '../cache/index.js';
import { mapWithConcurrency } from '../utils/index.js';
import { CACHE_VERSION } from '../shared/index.js';
import { activityDefinitionCache, activityIndexCache } from './state.js';
`;
const activitiesBody = normalizeCaches(
  stripExports(slice(1466, 1471) + '\n\n' + slice(1166, 1275))
);
const activitiesJs =
  activitiesImports +
  exportFunctions(activitiesBody, [
    'isValidActivityDefinition',
    'getActivityDefinitions',
    'getCachedActivityDefinition',
    'fetchLiveActivityDefinition',
    'resolveActivityDefinition',
    'getStaticActivityDefinition',
    'loadStaticActivityIndex',
    'fallbackActivityDefinition'
  ]);

const fireteamImports = `import { cleanText } from '../utils/index.js';
import { httpError, positiveNumber } from '../http/index.js';
import { bungieFetch } from '../bungie/index.js';
import { mapWithConcurrency } from '../utils/index.js';
import { parseTime } from '../utils/index.js';
import { getDestinySummary, getPublicCareerSummaryByMembership } from './summary.js';
import { getDestinyEndgame } from './endgame.js';
import { normalizeEndgameModes } from './shared.js';
import { resolveActivityDefinition, fallbackActivityDefinition } from './activities.js';
`;
const fireteamJs =
  fireteamImports + exportFunctions(stripExports(slice(93, 248) + '\n\n' + slice(333, 418)), ['getDestinyFireteam']);

const endgameImports = `import { cleanText } from '../utils/index.js';
import { normalizeEndgameActivityName, numberStat, percentStat, pvpModeLabel, statValue } from '../bungie/index.js';
import { httpError } from '../http/index.js';
import { bungieFetch } from '../bungie/index.js';
import { getWorkerCachedJson } from '../cache/index.js';
import { endgameCacheTtlSeconds } from '../cache/index.js';
import { CACHE_VERSION } from '../shared/index.js';
import {
  buildEndgameStatsPatch,
  historyPageLimit,
  historyPageSize,
  normalizeEndgameModes
} from './shared.js';
import { resolveEndgameTarget } from './targets.js';
import { getActivityDefinitions } from './activities.js';
import {
  decimalStat,
  ratioStat,
  secondsDisplayStat
} from './summary.js';
`;
const endgameJs =
  endgameImports +
  exportFunctions(
    stripExports(slice(522, 572) + '\n\n' + slice(1040, 1165) + '\n\n' + slice(1276, 1505)),
    [
      'getDestinyEndgame',
      'getEndgameCareer',
      'collectEndgameHistory',
      'addEndgameActivity',
      'buildEndgameMode',
      'buildPvpSubModes',
      'pvpModeSortWeight',
      'formatEndgameActivity',
      'formatEndgameVariant',
      'definitionForEndgameItem',
      'isValidActivityDefinition',
      'formatEndgameTotal'
    ]
  );

const detailsImports = `import { cleanText } from '../utils/index.js';
import { httpError, positiveNumber } from '../http/index.js';
import { bungieFetch } from '../bungie/index.js';
import { getWorkerCachedJson } from '../cache/index.js';
import { summaryCacheTtlSeconds, activityDefinitionConcurrency } from '../cache/index.js';
import { mapWithConcurrency } from '../utils/index.js';
import { CACHE_VERSION } from '../shared/index.js';
import { numberStat, percentStat } from '../bungie/index.js';
import { itemDefinitionCache } from './state.js';
import { privacyLabel, hasFailures } from './privacy.js';
import { resolveDetailsTarget } from './targets.js';
`;
const detailsJs =
  detailsImports +
  exportFunctions(normalizeCaches(stripExports(slice(573, 622) + '\n\n' + slice(730, 971))), [
    'getDestinyDetails',
    'summarizeDestinyDetails',
    'summarizeRecords',
    'summarizeCrafting',
    'enrichCraftableItems',
    'getInventoryItemDefinitions',
    'loadStaticGearItems',
    'inventoryItemIcon',
    'craftingPatternProgress'
  ]);

const indexJs = `export { getDestinyCareer } from './career.js';
export {
  getDestinyPlayerSearch,
  getDestinySummary,
  getPublicCareerSummaryByMembership
} from './summary.js';
export { getDestinyFireteam } from './fireteam.js';
export { getDestinyEndgame } from './endgame.js';
export { getDestinyDetails } from './details.js';
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'state.js'), stateJs);
fs.writeFileSync(path.join(outDir, 'privacy.js'), privacyJs);
fs.writeFileSync(path.join(outDir, 'shared.js'), sharedJs);
fs.writeFileSync(path.join(outDir, 'summary.js'), summaryJs);
fs.writeFileSync(path.join(outDir, 'targets.js'), targetsJs);
fs.writeFileSync(path.join(outDir, 'career.js'), careerJs);
fs.writeFileSync(path.join(outDir, 'activities.js'), activitiesJs);
fs.writeFileSync(path.join(outDir, 'fireteam.js'), fireteamJs);
fs.writeFileSync(path.join(outDir, 'endgame.js'), endgameJs);
fs.writeFileSync(path.join(outDir, 'details.js'), detailsJs);
fs.writeFileSync(path.join(outDir, 'index.js'), indexJs);

console.log('Split destiny modules into', outDir);
