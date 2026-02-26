import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { discoverFiles } from '../../src/utils/discover-files.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('discoverFiles', () => {
  it('recursively discovers files by extension in deterministic order', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'discover-files-'));
    tempDirs.push(rootDir);

    const alphaDir = path.join(rootDir, 'alpha');
    const nestedDir = path.join(alphaDir, 'nested');
    const betaDir = path.join(rootDir, 'beta');

    await mkdir(nestedDir, { recursive: true });
    await mkdir(betaDir, { recursive: true });

    const alphaFile = path.join(alphaDir, 'first.json');
    const nestedFile = path.join(nestedDir, 'second.json');
    const betaFile = path.join(betaDir, 'third.json');

    await writeFile(alphaFile, '{}', 'utf8');
    await writeFile(nestedFile, '{}', 'utf8');
    await writeFile(betaFile, '{}', 'utf8');
    await writeFile(path.join(rootDir, 'ignore.txt'), 'x', 'utf8');

    await expect(discoverFiles(rootDir, { extension: '.json' })).resolves.toEqual([
      alphaFile,
      nestedFile,
      betaFile,
    ]);
  });

  it('supports non-recursive discovery', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'discover-files-flat-'));
    tempDirs.push(rootDir);

    const nestedDir = path.join(rootDir, 'nested');
    await mkdir(nestedDir, { recursive: true });

    const rootFile = path.join(rootDir, 'root.json');
    const nestedFile = path.join(nestedDir, 'nested.json');

    await writeFile(rootFile, '{}', 'utf8');
    await writeFile(nestedFile, '{}', 'utf8');

    await expect(discoverFiles(rootDir, { extension: '.json', recursive: false })).resolves.toEqual(
      [rootFile],
    );
  });

  it('returns empty array for missing roots', async () => {
    const missingDir = path.join(os.tmpdir(), `discover-files-missing-${Date.now()}`);

    await expect(discoverFiles(missingDir, { extension: '.json' })).resolves.toEqual([]);
  });

  it('validates extension option', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'discover-files-ext-'));
    tempDirs.push(rootDir);

    await expect(discoverFiles(rootDir, { extension: '' })).rejects.toThrow(
      'discoverFiles extension must be a non-empty string',
    );
    await expect(discoverFiles(rootDir, { extension: 'json' })).rejects.toThrow(
      'discoverFiles extension must start with "."',
    );
  });
});
