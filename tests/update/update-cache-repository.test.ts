import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  getSessionScopedCachePath,
  readUpdateCheckCachePayload,
  writeUpdateCheckCachePayload,
} from '../../src/update/update-cache-repository.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function createTempDir(prefix: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}

describe('update-cache-repository', () => {
  it('builds a session-scoped cache path with sanitized session key', () => {
    const cacheFilePath = '/tmp/cache/update-check.json';

    const scopedPath = getSessionScopedCachePath(
      cacheFilePath,
      {
        LLM_USAGE_UPDATE_CACHE_SCOPE: 'session',
        LLM_USAGE_UPDATE_CACHE_SESSION_KEY: 'kitty/tab-1',
      },
      { parentPid: 777 },
    );

    expect(scopedPath).toBe('/tmp/cache/update-check.kitty_tab-1.json');
  });

  it('falls back to parent pid when session scope key is blank', () => {
    const scopedPath = getSessionScopedCachePath(
      '/tmp/cache/update-check.json',
      {
        LLM_USAGE_UPDATE_CACHE_SCOPE: 'session',
        LLM_USAGE_UPDATE_CACHE_SESSION_KEY: '   ',
      },
      { parentPid: 777 },
    );

    expect(scopedPath).toBe('/tmp/cache/update-check.ppid-777.json');
  });

  it('writes cache payloads and ignores malformed cache content on read', async () => {
    const tempDir = await createTempDir('update-cache-repository-');
    const cacheFilePath = path.join(tempDir, 'nested', 'update-check.json');

    await writeUpdateCheckCachePayload(cacheFilePath, {
      checkedAt: 1234,
      latestVersion: '1.2.3',
    });

    await expect(readUpdateCheckCachePayload(cacheFilePath)).resolves.toEqual({
      checkedAt: 1234,
      latestVersion: '1.2.3',
    });

    await writeFile(
      cacheFilePath,
      JSON.stringify({
        checkedAt: 1234,
        latestVersion: 'not-a-semver',
      }),
      'utf8',
    );

    await expect(readUpdateCheckCachePayload(cacheFilePath)).resolves.toBeUndefined();
  });
});
