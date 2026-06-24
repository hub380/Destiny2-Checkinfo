import { mkdirSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const bucket = process.env.R2_BUCKET || 'destiny2-checkinfo-data';
const prefix = trimSlashes(process.env.R2_GEAR_PREFIX || 'gear-cache');
const locale = String(process.env.BUNGIE_LOCALE || 'zh-chs').toLowerCase();
const rootDir = resolve('.');
const indexPath = resolve(rootDir, process.env.GEAR_INDEX_FILE || `public/data/gear-index-${locale}.json`);
const outDir = resolve(rootDir, 'work/gear-cache-upload');

try {
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  validateIndex(index);

  const manifestVersion = String(index.manifestVersion || 'unknown');
  const versionSegment = safeSegment(manifestVersion);
  const byteSize = statSync(indexPath).size;
  const r2Key = `${prefix}/${locale}/${versionSegment}/gear-index.json`;
  const pointer = {
    schemaVersion: 1,
    locale,
    manifestVersion,
    indexVersion: index.indexVersion || '',
    builtAt: index.builtAt || null,
    publishedAt: new Date().toISOString(),
    byteSize,
    r2Key,
    counts: {
      items: index.items.length,
      weapons: index.weapons.length,
      armors: Array.isArray(index.armors) ? index.armors.length : 0,
      perks: index.items.filter((item) => item.kind === 'perk').length,
      craftables: Array.isArray(index.craftables) ? index.craftables.length : 0
    }
  };

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const latestPath = resolve(outDir, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(pointer, null, 2), 'utf8');

  uploadFile(indexPath, r2Key, 'application/json');
  uploadFile(latestPath, `${prefix}/${locale}/latest.json`, 'application/json');
  publishKvPointer(pointer);

  console.log(`Published gear cache ${manifestVersion} to R2 bucket ${bucket}.`);
  console.log(`Items: ${pointer.counts.items}, weapons: ${pointer.counts.weapons}, perks: ${pointer.counts.perks}, size: ${formatBytes(byteSize)}`);
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

function validateIndex(index) {
  if (!index || !Array.isArray(index.items) || !Array.isArray(index.weapons)) {
    throw new Error(`Invalid gear index: ${indexPath}`);
  }
  if (!index.manifestVersion) {
    throw new Error('Invalid gear index: missing manifestVersion');
  }
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
    console.log(`Dry run: npx ${args.join(' ')}`);
    return;
  }
  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(errorMessage);
}

function safeSegment(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
