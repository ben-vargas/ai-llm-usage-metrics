import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  attributeUsageEventsToRepo,
  resolveRepoRootFromPathHint,
} from '../../src/efficiency/repo-attribution.js';
import { createUsageEvent } from '../../src/domain/usage-event.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('repo attribution', () => {
  it('resolves repo root from nested working directory paths', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'repo-root-resolve-'));
    tempDirs.push(rootDir);
    const nestedDir = path.join(rootDir, 'apps', 'service');

    await mkdir(nestedDir, { recursive: true });
    await writeFile(path.join(rootDir, '.git'), 'gitdir: /tmp/mock-git-dir\n', 'utf8');

    await expect(resolveRepoRootFromPathHint(nestedDir)).resolves.toBe(rootDir);
  });

  it('keeps only events attributed to the requested repository', async () => {
    const events = [
      createUsageEvent({
        source: 'pi',
        sessionId: 'matched',
        timestamp: '2026-02-12T10:00:00.000Z',
        repoRoot: '/workspace/repo-a/app',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      }),
      createUsageEvent({
        source: 'opencode',
        sessionId: 'excluded',
        timestamp: '2026-02-12T10:01:00.000Z',
        repoRoot: '/workspace/repo-b',
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25,
      }),
      createUsageEvent({
        source: 'codex',
        sessionId: 'unattributed',
        timestamp: '2026-02-12T10:02:00.000Z',
        inputTokens: 30,
        outputTokens: 5,
        totalTokens: 35,
      }),
    ];

    const result = await attributeUsageEventsToRepo(events, '/tmp/repo-a', async (pathHint) => {
      if (pathHint === '/workspace/repo-a/app') {
        return '/tmp/repo-a';
      }

      if (pathHint === '/workspace/repo-b') {
        return '/tmp/repo-b';
      }

      return undefined;
    });

    expect(result.matchedEventCount).toBe(1);
    expect(result.excludedEventCount).toBe(1);
    expect(result.unattributedEventCount).toBe(1);
    expect(result.matchedEvents[0]?.sessionId).toBe('matched');
    expect(result.matchedEvents[0]?.repoRoot).toBe('/tmp/repo-a');
  });

  it('matches events when --repo-dir points at a subdirectory inside the same repo', async () => {
    const events = [
      createUsageEvent({
        source: 'codex',
        sessionId: 'subdir-match',
        timestamp: '2026-02-12T10:03:00.000Z',
        repoRoot: '/workspace/repo-a/subproject',
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
      }),
    ];

    const result = await attributeUsageEventsToRepo(
      events,
      '/tmp/repo-a/subproject',
      async (hint) => {
        if (hint === '/tmp/repo-a/subproject') {
          return '/tmp/repo-a';
        }

        if (hint === '/workspace/repo-a/subproject') {
          return '/tmp/repo-a';
        }

        return undefined;
      },
    );

    expect(result.matchedEventCount).toBe(1);
    expect(result.excludedEventCount).toBe(0);
    expect(result.unattributedEventCount).toBe(0);
  });
});
