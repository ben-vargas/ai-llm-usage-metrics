import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseSelectedAdapters } from '../../src/cli/build-usage-data-parsing.js';
import { createUsageEvent } from '../../src/domain/usage-event.js';
import type { SourceAdapter } from '../../src/sources/source-adapter.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

class CountingJsonlAdapter implements SourceAdapter {
  public readonly id = 'counting' as const;

  public constructor(
    private readonly files: string[],
    private readonly parseCallCounter: { count: number },
  ) {}

  public async discoverFiles(): Promise<string[]> {
    return this.files;
  }

  public async parseFile(filePath: string) {
    this.parseCallCounter.count += 1;

    const content = await readFile(filePath, 'utf8');
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return [
      createUsageEvent({
        source: this.id,
        sessionId: path.basename(filePath, '.jsonl'),
        timestamp: '2026-02-01T00:00:00.000Z',
        totalTokens: lines.length || 1,
      }),
    ];
  }
}

const parseCacheOptions = {
  parseCache: {
    enabled: true,
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    maxEntries: 1_000,
    maxBytes: 16 * 1024 * 1024,
  },
};

describe('parseSelectedAdapters file cache', () => {
  it('reuses cached file parses on subsequent runs', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'parse-cache-hit-'));
    tempDirs.push(tempDir);

    const fileA = path.join(tempDir, 'a.jsonl');
    const fileB = path.join(tempDir, 'b.jsonl');
    const cacheFilePath = path.join(tempDir, 'parse-cache.json');
    await writeFile(fileA, '{"line":1}\n', 'utf8');
    await writeFile(fileB, '{"line":1}\n', 'utf8');

    const parseCalls = { count: 0 };
    const adapter = new CountingJsonlAdapter([fileA, fileB], parseCalls);

    const firstRun = await parseSelectedAdapters([adapter], 8, {
      ...parseCacheOptions,
      parseCacheFilePath: cacheFilePath,
    });

    expect(parseCalls.count).toBe(2);
    expect(firstRun.sourceFailures).toEqual([]);
    expect(firstRun.successfulParseResults[0]?.events).toHaveLength(2);

    const secondRun = await parseSelectedAdapters([adapter], 8, {
      ...parseCacheOptions,
      parseCacheFilePath: cacheFilePath,
    });

    expect(parseCalls.count).toBe(2);
    expect(secondRun.sourceFailures).toEqual([]);
    expect(secondRun.successfulParseResults[0]?.events).toHaveLength(2);
  });

  it('re-parses only files whose fingerprint changed', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'parse-cache-change-'));
    tempDirs.push(tempDir);

    const fileA = path.join(tempDir, 'a.jsonl');
    const fileB = path.join(tempDir, 'b.jsonl');
    const cacheFilePath = path.join(tempDir, 'parse-cache.json');
    await writeFile(fileA, '{"line":1}\n', 'utf8');
    await writeFile(fileB, '{"line":1}\n', 'utf8');

    const firstPassCalls = { count: 0 };
    await parseSelectedAdapters([new CountingJsonlAdapter([fileA, fileB], firstPassCalls)], 8, {
      ...parseCacheOptions,
      parseCacheFilePath: cacheFilePath,
    });
    expect(firstPassCalls.count).toBe(2);

    await writeFile(fileB, '{"line":1}\n{"line":2}\n', 'utf8');

    const secondPassCalls = { count: 0 };
    const secondRun = await parseSelectedAdapters(
      [new CountingJsonlAdapter([fileA, fileB], secondPassCalls)],
      8,
      {
        ...parseCacheOptions,
        parseCacheFilePath: cacheFilePath,
      },
    );

    expect(secondPassCalls.count).toBe(1);
    expect(secondRun.sourceFailures).toEqual([]);
    expect(secondRun.successfulParseResults[0]?.events).toHaveLength(2);
  });

  it('caps cache size and avoids unbounded growth', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'parse-cache-max-bytes-'));
    tempDirs.push(tempDir);

    const filePath = path.join(tempDir, 'a.jsonl');
    const cacheFilePath = path.join(tempDir, 'parse-cache.json');
    await writeFile(filePath, '{"line":1}\n', 'utf8');

    const firstPassCalls = { count: 0 };
    await parseSelectedAdapters([new CountingJsonlAdapter([filePath], firstPassCalls)], 8, {
      parseCache: {
        enabled: true,
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        maxEntries: 100,
        maxBytes: 300,
      },
      parseCacheFilePath: cacheFilePath,
    });
    expect(firstPassCalls.count).toBe(1);

    const secondPassCalls = { count: 0 };
    await parseSelectedAdapters([new CountingJsonlAdapter([filePath], secondPassCalls)], 8, {
      parseCache: {
        enabled: true,
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        maxEntries: 100,
        maxBytes: 300,
      },
      parseCacheFilePath: cacheFilePath,
    });
    expect(secondPassCalls.count).toBe(1);

    const cacheFileContent = await readFile(cacheFilePath, 'utf8');
    expect(Buffer.byteLength(cacheFileContent, 'utf8')).toBeLessThanOrEqual(300);
  });

  it('bypasses cache fingerprinting when discoverFiles returns virtual identifiers', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'parse-cache-virtual-paths-'));
    tempDirs.push(tempDir);

    const cacheFilePath = path.join(tempDir, 'parse-cache.json');
    const parseCalls = { count: 0 };
    const virtualAdapter: SourceAdapter = {
      id: 'virtual',
      discoverFiles: async () => ['/virtual/source-entry'],
      parseFile: async () => {
        parseCalls.count += 1;
        return [
          createUsageEvent({
            source: 'virtual',
            sessionId: 'virtual-session',
            timestamp: '2026-02-01T00:00:00.000Z',
            totalTokens: 1,
          }),
        ];
      },
    };

    const firstRun = await parseSelectedAdapters([virtualAdapter], 8, {
      ...parseCacheOptions,
      parseCacheFilePath: cacheFilePath,
    });
    const secondRun = await parseSelectedAdapters([virtualAdapter], 8, {
      ...parseCacheOptions,
      parseCacheFilePath: cacheFilePath,
    });

    expect(firstRun.sourceFailures).toEqual([]);
    expect(secondRun.sourceFailures).toEqual([]);
    expect(parseCalls.count).toBe(2);
  });
});
