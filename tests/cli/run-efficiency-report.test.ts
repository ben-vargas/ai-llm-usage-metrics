import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildEfficiencyReport, runEfficiencyReport } from '../../src/cli/run-efficiency-report.js';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function runGit(repoDir: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<void> {
  await execFileAsync('git', ['-C', repoDir, ...args], {
    env: {
      ...process.env,
      ...env,
    },
  });
}

async function createGitRepoWithCommit(commitIsoTimestamp: string): Promise<string> {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'efficiency-repo-'));
  tempDirs.push(repoDir);

  await runGit(repoDir, ['init']);
  await runGit(repoDir, ['config', 'user.name', 'Test User']);
  await runGit(repoDir, ['config', 'user.email', 'test@example.com']);

  const trackedFilePath = path.join(repoDir, 'tracked.txt');
  await writeFile(trackedFilePath, 'first line\nsecond line\n', 'utf8');

  await runGit(repoDir, ['add', 'tracked.txt']);
  await runGit(repoDir, ['commit', '-m', 'initial commit'], {
    GIT_AUTHOR_DATE: commitIsoTimestamp,
    GIT_COMMITTER_DATE: commitIsoTimestamp,
  });

  return repoDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;

  vi.restoreAllMocks();
});

describe('buildEfficiencyReport', () => {
  it('builds json report with git outcomes', async () => {
    const repoDir = await createGitRepoWithCommit('2026-02-14T10:00:00Z');
    const emptyDir = await mkdtemp(path.join(os.tmpdir(), 'efficiency-empty-sessions-'));
    tempDirs.push(emptyDir);

    const report = await buildEfficiencyReport('daily', {
      piDir: emptyDir,
      codexDir: emptyDir,
      source: 'pi,codex',
      timezone: 'UTC',
      since: '2026-02-14',
      until: '2026-02-14',
      repoDir,
      json: true,
    });

    const parsed = JSON.parse(report) as Array<Record<string, unknown>>;
    const grandTotal = parsed.at(-1);

    expect(grandTotal).toMatchObject({
      rowType: 'grand_total',
      periodKey: 'ALL',
      totalTokens: 0,
      costUsd: 0,
      commitCount: 0,
    });
  });

  it('rejects mutually exclusive output flags', async () => {
    await expect(
      buildEfficiencyReport('daily', {
        markdown: true,
        json: true,
      }),
    ).rejects.toThrow('Choose either --markdown or --json, not both');
  });
});

describe('runEfficiencyReport', () => {
  it('prints report output to stdout', async () => {
    const repoDir = await createGitRepoWithCommit('2026-02-14T10:00:00Z');
    const emptyDir = await mkdtemp(path.join(os.tmpdir(), 'efficiency-run-empty-sessions-'));
    tempDirs.push(emptyDir);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runEfficiencyReport('daily', {
      piDir: emptyDir,
      codexDir: emptyDir,
      source: 'pi,codex',
      timezone: 'UTC',
      since: '2026-02-14',
      until: '2026-02-14',
      repoDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleLogSpy.mock.calls[0]?.[0])).toContain('Daily Efficiency Report');
  });
});
