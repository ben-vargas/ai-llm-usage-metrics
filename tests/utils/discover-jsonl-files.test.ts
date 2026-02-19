import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { discoverJsonlFiles } from '../../src/utils/discover-jsonl-files.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('discoverJsonlFiles', () => {
  it('recursively discovers jsonl files in deterministic order', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'discover-jsonl-'));
    tempDirs.push(rootDir);

    const alphaDir = path.join(rootDir, 'alpha');
    const alphaNestedDir = path.join(alphaDir, 'nested');
    const betaDir = path.join(rootDir, 'beta');

    await mkdir(alphaNestedDir, { recursive: true });
    await mkdir(betaDir, { recursive: true });

    const alphaFile = path.join(alphaDir, 'first.jsonl');
    const alphaNestedFile = path.join(alphaNestedDir, 'second.jsonl');
    const betaFile = path.join(betaDir, 'third.jsonl');

    await writeFile(alphaFile, '{}\n', 'utf8');
    await writeFile(alphaNestedFile, '{}\n', 'utf8');
    await writeFile(betaFile, '{}\n', 'utf8');
    await writeFile(path.join(rootDir, 'ignore.txt'), 'not-jsonl\n', 'utf8');

    const discoveredFiles = await discoverJsonlFiles(rootDir);

    expect(discoveredFiles).toEqual([alphaFile, alphaNestedFile, betaFile]);
  });

  it('returns an empty list when the root directory does not exist', async () => {
    const missingDir = path.join(os.tmpdir(), `discover-jsonl-missing-${Date.now()}`);

    await expect(discoverJsonlFiles(missingDir)).resolves.toEqual([]);
  });

  it('propagates non-ENOENT discovery errors', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'discover-jsonl-errors-'));
    tempDirs.push(rootDir);

    const regularFile = path.join(rootDir, 'file.jsonl');
    await writeFile(regularFile, '{}\n', 'utf8');

    await expect(discoverJsonlFiles(regularFile)).rejects.toThrow();
  });
});
