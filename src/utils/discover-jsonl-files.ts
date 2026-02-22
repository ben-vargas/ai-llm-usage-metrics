import { readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

function isSkippableDirectoryReadError(error: unknown): boolean {
  const nodeError = error as NodeJS.ErrnoException;
  return nodeError.code === 'EACCES' || nodeError.code === 'EPERM';
}

async function walkDirectory(
  rootDir: string,
  acc: string[],
  options: { allowPermissionSkip: boolean },
): Promise<void> {
  let entries: Dirent[];

  try {
    entries = await readdir(rootDir, { withFileTypes: true, encoding: 'utf8' });
  } catch (error) {
    if (options.allowPermissionSkip && isSkippableDirectoryReadError(error)) {
      return;
    }

    throw error;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(entryPath, acc, { allowPermissionSkip: true });
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      acc.push(entryPath);
    }
  }
}

export async function discoverJsonlFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    await walkDirectory(rootDir, files, { allowPermissionSkip: false });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return files;
}
