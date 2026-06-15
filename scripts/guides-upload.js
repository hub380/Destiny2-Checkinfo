import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { contentTypeFor, loadGuideContent, objectKey } from './guides-content.js';

const bucket = process.env.R2_BUCKET || 'destiny2-checkinfo-data';
const prefix = process.env.R2_GUIDE_PREFIX || 'guides';
const outDir = resolve('work/guides-upload');

try {
  const content = loadGuideContent();
  for (const warning of content.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const indexPath = resolve(outDir, 'index.json');
  writeFileSync(indexPath, JSON.stringify(content.index, null, 2), 'utf8');
  uploadFile(indexPath, objectKey(prefix, 'index.json'));

  for (const detail of content.details) {
    const detailPath = resolve(outDir, `${detail.slug}.guide.json`);
    writeFileSync(detailPath, JSON.stringify(detail.value, null, 2), 'utf8');
    uploadFile(detailPath, objectKey(prefix, `${detail.slug}/guide.json`));
  }

  for (const media of content.mediaFiles) {
    uploadFile(media.path, objectKey(prefix, `${media.slug}/media/${media.relativePath}`));
  }

  console.log(`Uploaded ${content.details.length} guides and ${content.mediaFiles.length} media files to R2 bucket ${bucket}.`);
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

function uploadFile(filePath, key) {
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
    contentTypeFor(filePath)
  ];
  const result = spawnSync(npxCommand(), args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`wrangler r2 object put failed for ${target}`);
  }
}

function npxCommand() {
  return 'npx';
}
