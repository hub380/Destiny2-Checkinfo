import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLightggRollRecommendations } from '../../src/lib/gear/lightgg-recommendations.js';
import { buildRollRecommendations } from '../../src/lib/gear/roll-recommendations.js';
import { buildRollRecommendationBuckets } from '../../src/lib/gear/split-writer.js';
import { joinGearPath, rollRecommendationsBucketPath } from '../../src/lib/gear/split-paths.js';
import { mapWithConcurrency } from '../../src/lib/utils/concurrency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const gearDir = path.join(rootDir, 'public', 'data', 'gear');
const latestPath = path.join(gearDir, 'latest.json');
const uploadManifestPath = path.join(gearDir, 'upload-manifest.json');

const latestPointer = JSON.parse(await readFile(latestPath, 'utf8'));
const gearRoot = String(latestPointer.root || latestPointer.manifestVersion || '').trim();
if (!gearRoot) throw new Error('Local gear latest.json does not contain a gear root.');

const rootPath = path.join(gearDir, gearRoot);
const itemBucketDir = path.join(rootPath, 'items');
const rollBucketDir = path.join(rootPath, 'rolls');
const lightggRecommendationsFile = path.join(rootDir, 'content', 'gear', 'lightgg-roll-recommendations.json');
const generatedLightggRecommendationsFile = path.join(rootDir, 'work', 'lightgg', 'lightgg-roll-recommendations.json');
const { weaponRecords, overlays } = await readLocalGear(
  itemBucketDir,
  rollBucketDir,
  [lightggRecommendationsFile, generatedLightggRecommendationsFile]
);
const recommendations = buildRollRecommendations({ weapons: weaponRecords }, overlays);
const buckets = buildRollRecommendationBuckets(
  recommendations,
  latestPointer.locale || 'zh-chs',
  latestPointer.manifestVersion || gearRoot
);

const previousRollFiles = await directoryStats(rollBucketDir);
await rm(rollBucketDir, { recursive: true, force: true });
await mkdir(rollBucketDir, { recursive: true });

const writtenFiles = await mapWithConcurrency(
  Array.from(buckets.values()),
  32,
  async (bucket) => {
    const relativePath = path.posix.join(gearRoot, rollRecommendationsBucketPath(bucket.bucket));
    const absolutePath = path.join(gearDir, ...relativePath.split('/'));
    const body = JSON.stringify(bucket);
    await writeFile(absolutePath, body);
    return {
      relativePath,
      size: Buffer.byteLength(body),
      sha256: createHash('sha256').update(body).digest('hex')
    };
  }
);

const newRollBytes = writtenFiles.reduce((sum, file) => sum + file.size, 0);
await updateUploadManifest(writtenFiles, gearRoot);

latestPointer.generatedAt = new Date().toISOString();
latestPointer.byteSize = Math.max(0, Number(latestPointer.byteSize || 0) - previousRollFiles.bytes + newRollBytes);
latestPointer.counts = {
  ...(latestPointer.counts || {}),
  rollBuckets: writtenFiles.length,
  recommendedWeapons: recommendations.length,
  recommendationSets: recommendations.reduce((sum, entry) => sum + (entry.recommendations?.length || 0), 0),
  files: Math.max(0, Number(latestPointer.counts?.files || 0) - previousRollFiles.count + writtenFiles.length)
};
await writeFile(latestPath, JSON.stringify(latestPointer, null, 2));

console.log(`Recommendation cache: ${recommendations.length} weapons, ${latestPointer.counts.recommendationSets} sets.`);
console.log(`Roll buckets: ${writtenFiles.length}, ${formatBytes(newRollBytes)}.`);

async function readLocalGear(itemsDir, rollsDir, lightggFiles) {
  const itemNames = (await readdir(itemsDir)).filter((name) => name.endsWith('.json'));
  const itemBuckets = await mapWithConcurrency(itemNames, 16, async (name) => (
    JSON.parse(await readFile(path.join(itemsDir, name), 'utf8'))
  ));
  const weaponRecords = itemBuckets.flatMap((bucket) => Object.values(bucket.items || {}))
    .filter((entry) => entry?.kind === 'weapon' && entry?.itemRecord)
    .map((entry) => entry.itemRecord);

  const overlays = [];
  try {
    const rollNames = (await readdir(rollsDir)).filter((name) => name.endsWith('.json'));
    const rollBuckets = await mapWithConcurrency(rollNames, 16, async (name) => (
      JSON.parse(await readFile(path.join(rollsDir, name), 'utf8'))
    ));
    for (const bucket of rollBuckets) {
      for (const entry of Object.values(bucket.items || {})) {
        const curated = (entry.recommendations || []).filter((recommendation) => (
          recommendation.source !== 'local-heuristic' && recommendation.source !== 'light.gg'
        ));
        if (curated.length) overlays.push({ weaponHash: entry.weaponHash, recommendations: curated });
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const lightggOverlays = await Promise.all(
    (lightggFiles || []).map((filePath) => readLightggRecommendations(filePath))
  );
  overlays.push(...lightggOverlays.flat());

  return { weaponRecords, overlays };
}

async function readLightggRecommendations(filePath) {
  if (!filePath || !existsSync(filePath)) return [];
  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  return normalizeLightggRollRecommendations(raw);
}

async function updateUploadManifest(files, root) {
  const uploadManifest = JSON.parse(await readFile(uploadManifestPath, 'utf8'));
  const rollPrefix = `${root}/rolls/`;
  for (const relativePath of Object.keys(uploadManifest.files || {})) {
    if (relativePath.startsWith(rollPrefix)) delete uploadManifest.files[relativePath];
  }
  for (const file of files) {
    uploadManifest.files[file.relativePath] = {
      sha256: file.sha256,
      size: file.size,
      r2Key: joinGearPath(file.relativePath)
    };
  }
  uploadManifest.generatedAt = new Date().toISOString();
  await writeFile(uploadManifestPath, JSON.stringify(uploadManifest, null, 2));
}

async function directoryStats(directory) {
  try {
    const names = (await readdir(directory)).filter((name) => name.endsWith('.json'));
    const stats = await Promise.all(names.map((name) => stat(path.join(directory, name))));
    return { count: names.length, bytes: stats.reduce((sum, entry) => sum + entry.size, 0) };
  } catch (error) {
    if (error?.code === 'ENOENT') return { count: 0, bytes: 0 };
    throw error;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
