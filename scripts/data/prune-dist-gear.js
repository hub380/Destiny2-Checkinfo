import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [
  resolve('dist/data/gear'),
  resolve('dist/data/gear-index-zh-chs.json')
];

for (const target of targets) {
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
}
