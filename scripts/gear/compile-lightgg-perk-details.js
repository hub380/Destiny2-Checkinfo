import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileLightggPerkDetails } from '../../src/lib/gear/lightgg-perk-details.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const snapshotDir = path.resolve(
  rootDir,
  process.env.LIGHTGG_PERK_SNAPSHOT_DIR || path.join('work', 'lightgg', 'perks')
);
const outputFile = path.resolve(
  rootDir,
  process.env.LIGHTGG_PERK_DETAILS_FILE || path.join('work', 'lightgg', 'lightgg-perk-details.json')
);

const snapshots = await readSnapshots(snapshotDir);
if (!snapshots.length) {
  throw new Error(`No Light.gg perk snapshots found in ${path.relative(rootDir, snapshotDir)}.`);
}

const cache = compileLightggPerkDetails(snapshots);
await mkdir(path.dirname(outputFile), { recursive: true });
const temporaryFile = `${outputFile}.tmp`;
await writeFile(temporaryFile, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
await rename(temporaryFile, outputFile);

console.log(`Light.gg perk details: ${cache.counts.perks} perks, ${cache.counts.lines} value lines.`);
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
