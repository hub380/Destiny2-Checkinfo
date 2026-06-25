import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serverGearDeps } from '../src/lib/gear/server-deps.js';

describe('server gear deps', () => {
  it('uses the editable source aliases file over generated aliases', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'gear-server-deps-'));
    const dataDir = join(rootDir, 'gear');
    const aliasesFile = join(rootDir, 'source-aliases.json');
    const manifestRoot = join(dataDir, 'test-manifest');

    try {
      await mkdir(manifestRoot, { recursive: true });
      await writeFile(
        join(manifestRoot, 'source-aliases.json'),
        JSON.stringify({ schemaVersion: 1, aliases: { stale: { zh: 'stale' } } }),
        'utf8'
      );
      await writeFile(
        aliasesFile,
        JSON.stringify({ schemaVersion: 1, aliases: { fresh: { zh: 'fresh' } } }),
        'utf8'
      );

      const deps = serverGearDeps(
        { BUNGIE_API_KEY: 'test-key' },
        { dataDir, sourceAliasesFile: aliasesFile }
      );
      const aliases = await deps.readGearJson('test-manifest/source-aliases.json');

      expect(Object.keys(aliases.aliases)).toEqual(['fresh']);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
