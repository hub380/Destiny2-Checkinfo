import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileLightggSnapshots } from '../../src/lib/gear/lightgg-cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const snapshotDir = path.resolve(
  rootDir,
  process.env.LIGHTGG_SNAPSHOT_DIR || path.join('work', 'lightgg', 'items')
);
const outputFile = path.resolve(
  rootDir,
  process.env.LIGHTGG_CACHE_FILE || path.join('work', 'lightgg', 'lightgg-roll-recommendations.json')
);

const snapshots = await readSnapshots(snapshotDir);
if (!snapshots.length) {
  throw new Error(`No Light.gg snapshots found in ${path.relative(rootDir, snapshotDir)}.`);
}

const cache = compileLightggSnapshots(snapshots);
await mkdir(path.dirname(outputFile), { recursive: true });
const temporaryFile = `${outputFile}.tmp`;
await writeFile(temporaryFile, `${JSON.stringify(cache, null, 2)}\n`);
await rename(temporaryFile, outputFile);

console.log(`Light.gg cache: ${cache.counts.weapons} weapons, ${cache.counts.traitCombos} trait combos.`);
console.log(`Wrote ${path.relative(rootDir, outputFile)}.`);

async function readSnapshots(directory) {
  let names;
  try {
    names = (await readdir(directory))
      .filter((name) => /^\d+\.json$/i.test(name))
      .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const snapshots = [];
  for (const name of names) {
    const value = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
    snapshots.push(value);
  }
  return snapshots;
}
