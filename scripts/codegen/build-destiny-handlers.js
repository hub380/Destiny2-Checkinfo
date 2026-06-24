/**
 * Destiny API logic lives in src/lib/destiny/*.js (see index.js).
 *
 * To regenerate slices from a monolithic snapshot, place it at
 * src/lib/destiny-handlers.source.js and run:
 *   npm run codegen:destiny
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const sourcePath = path.join(rootDir, 'src', 'lib', 'destiny-handlers.source.js');

if (!fs.existsSync(sourcePath)) {
  console.error(
    'Monolithic destiny-handlers rebuild is deprecated. Edit src/lib/destiny/ directly,\n' +
      'or add src/lib/destiny-handlers.source.js and run: npm run codegen:destiny'
  );
  process.exit(1);
}

await import('./split-destiny.mjs');
