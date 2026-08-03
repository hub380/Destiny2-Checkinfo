import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  GEAR_PACKED_PREFIX,
  GEAR_SPLIT_PREFIX,
  manifestRoot,
  trimSlashes,
  uploadManifestPath
} from '../../src/lib/gear/split-paths.js';

const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
loadEnvFile(resolve(rootDir, '.env'));

const bucket = process.env.R2_BUCKET || 'destiny2-checkinfo-data';
let prefix = trimSlashes(process.env.R2_GEAR_PREFIX || '');
const locale = String(process.env.BUNGIE_LOCALE || 'zh-chs').toLowerCase();
const gearDir = resolve(rootDir, process.env.GEAR_SPLIT_DIR || 'public/data/gear');
const workDir = resolve(rootDir, 'work/gear-cache-upload');
const dryRunSamples = [];
let dryRunCount = 0;

try {
  const localPointer = JSON.parse(readFileSync(resolve(gearDir, 'latest.json'), 'utf8'));
  validatePointer(localPointer);
  if (!prefix) {
    prefix = Number(localPointer.schemaVersion) >= 3 ? GEAR_PACKED_PREFIX : GEAR_SPLIT_PREFIX;
  }

  const pointer = {
    ...localPointer,
    publishedAt: new Date().toISOString(),
    root: manifestRoot(prefix, locale, localPointer.manifestVersion)
  };

  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  const latestPath = resolve(workDir, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(pointer, null, 2), 'utf8');

  const forceUpload = process.env.GEAR_CACHE_FORCE === '1';
  const localUploadManifest = readLocalUploadManifest();
  const remoteUploadManifest = forceUpload ? null : fetchR2Json(bucket, prefix, locale, uploadManifestPath());
  const bulkEntries = buildBulkEntries(localUploadManifest, remoteUploadManifest, forceUpload);

  if (bulkEntries.length) {
    const bulkManifestPath = resolve(workDir, 'bulk-manifest.json');
    writeFileSync(bulkManifestPath, JSON.stringify(bulkEntries, null, 2), 'utf8');
    bulkUpload(bulkManifestPath);
  } else {
    console.log(`Gear cache ${pointer.manifestVersion} has no changed object files to upload.`);
  }

  const uploadManifestFile = resolve(gearDir, uploadManifestPath());
  if (existsSync(uploadManifestFile)) {
    uploadFile(uploadManifestFile, `${prefix}/${locale}/${uploadManifestPath()}`, 'application/json');
  }
  uploadFile(latestPath, `${prefix}/${locale}/latest.json`, 'application/json');
  publishKvPointer(pointer);

  const byteSize = bulkEntries.reduce((sum, entry) => sum + statSync(entry.file).size, 0) + statSync(latestPath).size;
  const action = process.env.GEAR_CACHE_DRY_RUN === '1' ? 'Prepared' : 'Published';
  console.log(`${action} gear cache ${pointer.manifestVersion} to R2 bucket ${bucket}.`);
  console.log(`Changed files: ${bulkEntries.length}, items: ${pointer.counts?.items || 0}, uploaded size: ${formatBytes(byteSize)}`);

  if (dryRunCount) {
    console.log(`Dry run commands: ${dryRunCount}`);
    for (const sample of dryRunSamples) console.log(`Dry run sample: npx ${sample}`);
  }
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

function readLocalUploadManifest() {
  const filePath = resolve(gearDir, uploadManifestPath());
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function buildBulkEntries(localUploadManifest, remoteUploadManifest, forceUpload) {
  const entries = localUploadManifest?.files && typeof localUploadManifest.files === 'object'
    ? Object.entries(localUploadManifest.files)
    : null;

  if (!entries) {
    return listFiles(gearDir)
      .filter((filePath) => filePath !== resolve(gearDir, 'latest.json'))
      .map((filePath) => {
        const relativePath = toPosix(relative(gearDir, filePath));
        return {
          key: `${prefix}/${locale}/${relativePath}`,
          file: filePath
        };
      });
  }

  const remoteFiles = remoteUploadManifest?.files && typeof remoteUploadManifest.files === 'object'
    ? remoteUploadManifest.files
    : {};

  return entries
    .filter(([relativePath, entry]) => {
      if (forceUpload) return true;
      const remoteEntry = remoteFiles[relativePath];
      return !remoteEntry || remoteEntry.sha256 !== entry.sha256 || remoteEntry.size !== entry.size;
    })
    .map(([relativePath, entry]) => ({
      key: `${prefix}/${locale}/${entry.r2Key || relativePath}`,
      file: resolve(gearDir, relativePath)
    }))
    .filter((entry) => existsSync(entry.file));
}

function fetchR2Json(bucketName, gearPrefix, gearLocale, relativePath) {
  if (process.env.GEAR_CACHE_DRY_RUN === '1') return null;
  const key = `${bucketName}/${gearPrefix}/${gearLocale}/${relativePath}`;
  const outFile = resolve(workDir, `r2-${relativePath.replace(/[^a-zA-Z0-9._-]+/g, '-')}`);
  mkdirSync(workDir, { recursive: true });
  const args = [
    'wrangler', 'r2', 'object', 'get', key,
    process.env.R2_UPLOAD_LOCAL === '1' ? '--local' : '--remote',
    '--file', outFile
  ];
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', ['npx', ...args].map(quoteCmdArg).join(' ')], { stdio: 'pipe', shell: false })
    : spawnSync('npx', args, { stdio: 'pipe', shell: false });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(readFileSync(outFile, 'utf8'));
  } catch {
    return null;
  }
}

function validatePointer(pointer) {
  const schemaVersion = Number(pointer?.schemaVersion || 0);
  if (!pointer || ![2, 3].includes(schemaVersion) || !pointer.manifestVersion || !pointer.root) {
    throw new Error(`Invalid v2/v3 gear pointer: ${resolve(gearDir, 'latest.json')}`);
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
    'wrangler', 'r2', 'object', 'put', target,
    process.env.R2_UPLOAD_LOCAL === '1' ? '--local' : '--remote',
    '--file', filePath,
    '--content-type', contentType
  ];
  runNpx(args, `wrangler r2 object put failed for ${target}`);
}

function bulkUpload(filename) {
  const args = [
    'wrangler', 'r2', 'bulk', 'put', bucket,
    process.env.R2_UPLOAD_LOCAL === '1' ? '--local' : '--remote',
    '--filename', filename,
    '--content-type', 'application/json',
    '--concurrency', String(positiveNumber(process.env.R2_UPLOAD_CONCURRENCY, 50)),
    '--force'
  ];
  runNpx(args, `wrangler r2 bulk put failed for ${bucket}`);
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

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = stripEnvQuotes(rawValue.trim());
  }
}

function stripEnvQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
