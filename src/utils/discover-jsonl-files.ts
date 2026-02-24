import { readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

import { asRecord } from './as-record.js';
import { compareByCodePoint } from './compare-by-code-point.js';

function getNodeErrorCode(error: unknown): string | undefined {
  const record = asRecord(error);
  return typeof record?.code === 'string' ? record.code : undefined;
}

function isSkippableDirectoryReadError(error: unknown): boolean {
  const code = getNodeErrorCode(error);
  return code === 'EACCES' || code === 'EPERM';
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

  entries.sort((left, right) => compareByCodePoint(left.name, right.name));

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(entryPath, acc, { allowPermissionSkip: true });
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) {
      acc.push(entryPath);
    }
  }
}

export async function discoverJsonlFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    await walkDirectory(rootDir, files, { allowPermissionSkip: false });
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return files;
}
