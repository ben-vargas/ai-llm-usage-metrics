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
  it('builds default adapters in stable order', () => {
    const adapters = createDefaultAdapters({});

    expect(adapters.map((adapter) => adapter.id)).toEqual(['pi', 'codex', 'opencode']);
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

  it('throws on duplicate source ids in source directory overrides', () => {
    expect(() => createDefaultAdapters({ sourceDir: ['pi=/tmp/a', 'pi=/tmp/b'] })).toThrow(
      'Duplicate --source-dir source id: pi',
    );
  });

  it('throws on unknown source ids in source directory overrides', () => {
    expect(() => createDefaultAdapters({ sourceDir: ['opencode=/tmp/opencode'] })).toThrow(
      '--source-dir does not support "opencode". Use --opencode-db instead.',
    );
  });

  it('wires --opencode-db into the OpenCode adapter discovery path', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'usage-adapters-opencode-db-'));
    tempDirs.push(tempDir);
    const opencodeDbPath = path.join(tempDir, 'opencode.db');
    await writeFile(opencodeDbPath, '', 'utf8');

    const adapters = createDefaultAdapters({ opencodeDb: opencodeDbPath });
    const opencodeAdapter = adapters.find((adapter) => adapter.id === 'opencode');

    await expect(opencodeAdapter?.discoverFiles()).resolves.toEqual([opencodeDbPath]);
  });

  it('throws when --opencode-db is blank', () => {
    expect(() => createDefaultAdapters({ opencodeDb: '   ' })).toThrow(
      '--opencode-db must be a non-empty path',
    );
  });

  it('throws when --pi-dir is blank', () => {
    expect(() => createDefaultAdapters({ piDir: '   ' })).toThrow(
      '--pi-dir must be a non-empty path',
    );
  });

  it('throws when --codex-dir is blank', () => {
    expect(() => createDefaultAdapters({ codexDir: '   ' })).toThrow(
      '--codex-dir must be a non-empty path',
    );
  });

  it('fails pi discovery when an explicitly configured directory is missing', async () => {
    const adapters = createDefaultAdapters({
      piDir: path.join(os.tmpdir(), `missing-pi-${Date.now()}`),
    });
    const piAdapter = adapters.find((adapter) => adapter.id === 'pi');

    await expect(piAdapter?.discoverFiles()).rejects.toThrow(
      'PI sessions directory is missing or unreadable',
    );
  });

  it('fails codex discovery when an explicitly configured directory is missing', async () => {
    const adapters = createDefaultAdapters({
      codexDir: path.join(os.tmpdir(), `missing-codex-${Date.now()}`),
    });
    const codexAdapter = adapters.find((adapter) => adapter.id === 'codex');

    await expect(codexAdapter?.discoverFiles()).rejects.toThrow(
      'Codex sessions directory is missing or unreadable',
    );
  });
});
