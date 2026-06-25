import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { manifestRoot, trimSlashes } from '../../src/lib/gear/split-paths.js';

const bucket = process.env.R2_BUCKET || 'destiny2-checkinfo-data';
const prefix = trimSlashes(process.env.R2_GEAR_PREFIX || 'gear-cache/v2');
const locale = String(process.env.BUNGIE_LOCALE || 'zh-chs').toLowerCase();
const rootDir = resolve('.');
const gearDir = resolve(rootDir, process.env.GEAR_SPLIT_DIR || 'public/data/gear');
const sourceAliasesFile = resolve(rootDir, process.env.GEAR_SOURCE_ALIASES_FILE || 'content/gear/source-aliases.json');
const workDir = resolve(rootDir, 'work/gear-cache-upload');
const dryRunSamples = [];
let dryRunCount = 0;

try {
  const localPointer = JSON.parse(readFileSync(resolve(gearDir, 'latest.json'), 'utf8'));
  validatePointer(localPointer);

  const pointer = {
    ...localPointer,
    publishedAt: new Date().toISOString(),
    root: manifestRoot(prefix, locale, localPointer.manifestVersion)
  };

  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const latestPath = resolve(workDir, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(pointer, null, 2), 'utf8');

  const files = listFiles(gearDir).filter((filePath) => filePath !== resolve(gearDir, 'latest.json'));
  const bulkEntries = [];
  for (const filePath of files) {
    const relativePath = toPosix(relative(gearDir, filePath));
    bulkEntries.push({
      key: `${prefix}/${locale}/${relativePath}`,
      file: filePath
    });
  }
  const aliasesUploaded = appendSourceAliases(bulkEntries, localPointer.root);
  const bulkManifestPath = resolve(workDir, 'bulk-manifest.json');
  writeFileSync(bulkManifestPath, JSON.stringify(bulkEntries, null, 2), 'utf8');
  if (bulkEntries.length) bulkUpload(bulkManifestPath);
  uploadFile(latestPath, `${prefix}/${locale}/latest.json`, 'application/json');
  publishKvPointer(pointer);

  const byteSize = bulkEntries.reduce((sum, entry) => sum + statSync(entry.file).size, 0) + statSync(latestPath).size;
  const action = process.env.GEAR_CACHE_DRY_RUN === '1' ? 'Prepared' : 'Published';
  console.log(`${action} gear cache ${pointer.manifestVersion} to R2 bucket ${bucket}.`);
  console.log(`Files: ${bulkEntries.length + 1}, items: ${pointer.counts?.items || 0}, size: ${formatBytes(byteSize)}, aliases: ${aliasesUploaded ? 'yes' : 'no'}`);
  if (dryRunCount) {
    console.log(`Dry run commands: ${dryRunCount}`);
    for (const sample of dryRunSamples) console.log(`Dry run sample: npx ${sample}`);
  }
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

function validatePointer(pointer) {
  if (!pointer || Number(pointer.schemaVersion) !== 2 || !pointer.manifestVersion || !pointer.root) {
    throw new Error(`Invalid v2 gear pointer: ${resolve(gearDir, 'latest.json')}`);
  }
}

function listFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFiles(filePath));
    } else if (entry.isFile()) {
      output.push(filePath);
    }
  }
  return output;
}

function uploadFile(filePath, key, contentType) {
  const target = `${bucket}/${key}`;
  const args = [
    'wrangler',
    'r2',
    'object',
    'put',
    target,
    process.env.R2_UPLOAD_LOCAL === '1' ? '--local' : '--remote',
    '--file',
    filePath,
    '--content-type',
    contentType
  ];
  runNpx(args, `wrangler r2 object put failed for ${target}`);
}

function bulkUpload(filename) {
  const args = [
    'wrangler',
    'r2',
    'bulk',
    'put',
    bucket,
    process.env.R2_UPLOAD_LOCAL === '1' ? '--local' : '--remote',
    '--filename',
    filename,
    '--content-type',
    'application/json',
    '--concurrency',
    String(positiveNumber(process.env.R2_UPLOAD_CONCURRENCY, 20)),
    '--force'
  ];
  runNpx(args, `wrangler r2 bulk put failed for ${bucket}`);
}

function appendSourceAliases(entries, root) {
  if (!existsSync(sourceAliasesFile)) return false;
  JSON.parse(readFileSync(sourceAliasesFile, 'utf8'));
  entries.push({
    key: `${prefix}/${locale}/${root}/source-aliases.json`,
    file: sourceAliasesFile
  });
  return true;
}

function publishKvPointer(pointer) {
  if (process.env.GEAR_CACHE_WRITE_KV !== '1') return;
  const key = `gear-cache:latest:${locale}`;
  const args = ['wrangler', 'kv', 'key', 'put', key, JSON.stringify(pointer), '--binding', 'CAREER_CACHE'];
  if (process.env.R2_UPLOAD_LOCAL === '1') {
    args.push('--local');
  } else {
    args.push('--remote');
  }
  runNpx(args, `wrangler kv key put failed for ${key}`);
}

function runNpx(args, errorMessage) {
  if (process.env.GEAR_CACHE_DRY_RUN === '1') {
    dryRunCount += 1;
    if (dryRunSamples.length < 5) dryRunSamples.push(args.join(' '));
    return;
  }
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', ['npx', ...args].map(quoteCmdArg).join(' ')], {
        stdio: 'inherit',
        shell: false
      })
    : spawnSync('npx', args, {
        stdio: 'inherit',
        shell: false
      });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(errorMessage);
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s&()^|<>"]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}
