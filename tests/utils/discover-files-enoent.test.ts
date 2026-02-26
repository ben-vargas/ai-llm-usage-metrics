import type { Dirent, PathLike } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const { readdirMock } = vi.hoisted(() => ({
  readdirMock: vi.fn(),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual('node:fs/promises');

  return {
    ...actual,
    readdir: readdirMock,
  };
});

import { discoverFiles } from '../../src/utils/discover-files.js';

function createDirent(name: string, kind: 'file' | 'directory'): Dirent {
  return {
    name,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'directory',
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  } as Dirent;
}

afterEach(() => {
  readdirMock.mockReset();
});

describe('discoverFiles ENOENT handling', () => {
  it('keeps already discovered files when a nested directory disappears', async () => {
    const rootDir = '/virtual-root';
    const missingNestedDir = path.join(rootDir, 'ghost');

    readdirMock.mockImplementation((async (targetPath: PathLike) => {
      if (String(targetPath) === rootDir) {
        return [
          createDirent('a.json', 'file'),
          createDirent('ghost', 'directory'),
          createDirent('b.json', 'file'),
        ];
      }

      if (String(targetPath) === missingNestedDir) {
        const error = new Error('missing directory') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }

      throw new Error(`Unexpected readdir path in test: ${String(targetPath)}`);
    }) as never);

    await expect(discoverFiles(rootDir, { extension: '.json' })).resolves.toEqual([
      path.join(rootDir, 'a.json'),
      path.join(rootDir, 'b.json'),
    ]);
  });
});
