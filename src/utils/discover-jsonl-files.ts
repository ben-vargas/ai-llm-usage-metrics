import { readdir } from 'node:fs/promises';
import path from 'node:path';

async function walkDirectory(rootDir: string, acc: string[]): Promise<void> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(entryPath, acc);
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
    await walkDirectory(rootDir, files);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return files;
}
