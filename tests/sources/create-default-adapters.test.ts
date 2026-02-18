import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultAdapters } from '../../src/sources/create-default-adapters.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('createDefaultAdapters', () => {
  it('builds pi and codex adapters in stable order', () => {
    const adapters = createDefaultAdapters({});

    expect(adapters.map((adapter) => adapter.id)).toEqual(['pi', 'codex']);
  });

  it('supports generic source directory overrides', async () => {
    const piTempDir = await mkdtemp(path.join(os.tmpdir(), 'usage-adapters-pi-source-dir-'));
    const codexTempDir = await mkdtemp(path.join(os.tmpdir(), 'usage-adapters-codex-source-dir-'));
    tempDirs.push(piTempDir, codexTempDir);

    const piFile = path.join(piTempDir, 'pi-session.jsonl');
    const codexFile = path.join(codexTempDir, 'codex-session.jsonl');

    await writeFile(piFile, '{}\n', 'utf8');
    await writeFile(codexFile, '{}\n', 'utf8');

    const adapters = createDefaultAdapters({
      sourceDir: [`pi=${piTempDir}`, `codex=${codexTempDir}`],
    });

    await expect(adapters[0].discoverFiles()).resolves.toEqual([piFile]);
    await expect(adapters[1].discoverFiles()).resolves.toEqual([codexFile]);
  });

  it('throws on invalid source directory override entries', () => {
    expect(() => createDefaultAdapters({ sourceDir: ['invalid'] })).toThrow(
      '--source-dir must use format <source-id>=<path>',
    );
  });

  it('throws on unknown source ids in source directory overrides', () => {
    expect(() => createDefaultAdapters({ sourceDir: ['opencode=/tmp/opencode'] })).toThrow(
      'Unknown --source-dir source id(s): opencode. Allowed values: codex, pi',
    );
  });
});
