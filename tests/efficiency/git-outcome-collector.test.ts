import { describe, expect, it, vi } from 'vitest';

import {
  collectGitOutcomes,
  parseGitLogShortstatLines,
} from '../../src/efficiency/git-outcome-collector.js';

const marker = '\u001f';

describe('parseGitLogShortstatLines', () => {
  it('parses commit boundaries and shortstat lines', () => {
    const events = parseGitLogShortstatLines([
      `${marker}1760090400${marker}abcdef1${marker}dev@example.com`,
      ' 1 file changed, 12 insertions(+), 3 deletions(-)',
      '',
      `${marker}1760094000${marker}abcdef2${marker}dev@example.com`,
      ' 2 files changed, 5 deletions(-)',
      `${marker}1760097600${marker}abcdef3${marker}dev@example.com`,
    ]);

    expect(events).toEqual([
      {
        sha: 'abcdef1',
        timestamp: '2025-10-10T10:00:00.000Z',
        linesAdded: 12,
        linesDeleted: 3,
        linesChanged: 15,
      },
      {
        sha: 'abcdef2',
        timestamp: '2025-10-10T11:00:00.000Z',
        linesAdded: 0,
        linesDeleted: 5,
        linesChanged: 5,
      },
      {
        sha: 'abcdef3',
        timestamp: '2025-10-10T12:00:00.000Z',
        linesAdded: 0,
        linesDeleted: 0,
        linesChanged: 0,
      },
    ]);
  });

  it('filters out commits that do not match the configured author email', () => {
    const events = parseGitLogShortstatLines(
      [
        `${marker}1760090400${marker}abcdef1${marker}dev.test+tools@example.com`,
        ' 1 file changed, 2 insertions(+)',
        `${marker}1760094000${marker}abcdef2${marker}devXtest+tools@exampleXcom`,
        ' 1 file changed, 9 insertions(+)',
      ],
      'dev.test+tools@example.com',
    );

    expect(events).toEqual([
      {
        sha: 'abcdef1',
        timestamp: '2025-10-10T10:00:00.000Z',
        linesAdded: 2,
        linesDeleted: 0,
        linesChanged: 2,
      },
    ]);
  });
});

describe('collectGitOutcomes', () => {
  it('collects and aggregates outcomes with date filtering and default no-merges', async () => {
    const runGitCommand = vi.fn<
      (
        repoDir: string,
        args: string[],
      ) => Promise<{ lines: string[]; stderr: string; exitCode: number }>
    >(async (_repoDir, args) => {
      if (args[0] === 'config') {
        return {
          lines: ['dev.test+tools@example.com'],
          stderr: '',
          exitCode: 0,
        };
      }

      return {
        lines: [
          `${marker}1770681600${marker}abcdef1${marker}devXtest+tools@exampleXcom`,
          ' 1 file changed, 9 insertions(+), 1 deletion(-)',
          `${marker}1770681600${marker}abcdef2${marker}dev.test+tools@example.com`,
          ' 1 file changed, 1 insertion(+), 1 deletion(-)',
          `${marker}1770771600${marker}abcdef3${marker}dev.test+tools@example.com`,
          ' 2 files changed, 4 insertions(+), 2 deletions(-)',
        ],
        stderr: '',
        exitCode: 0,
      };
    });

    const result = await collectGitOutcomes(
      {
        repoDir: '/tmp/repo',
        granularity: 'daily',
        timezone: 'UTC',
        since: '2026-02-11',
        until: '2026-02-11',
      },
      { runGitCommand },
    );

    expect(runGitCommand).toHaveBeenCalledTimes(2);
    const configArgs = (runGitCommand.mock.calls[0]?.[1] as string[] | undefined) ?? [];
    const args = (runGitCommand.mock.calls[1]?.[1] as string[] | undefined) ?? [];

    expect(configArgs).toEqual(['config', '--get', 'user.email']);

    expect(args).toContain('--no-merges');
    expect(args).toContain('--author=<dev.test+tools@example.com>');
    expect(args).toContain(`--pretty=format:${marker}%ct${marker}%H${marker}%ae`);
    expect(args).toContain('--since=2026-02-10T00:00:00Z');
    expect(args).toContain('--until=2026-02-12T23:59:59Z');

    expect([...result.periodOutcomes.entries()]).toEqual([
      [
        '2026-02-11',
        {
          commitCount: 1,
          linesAdded: 4,
          linesDeleted: 2,
          linesChanged: 6,
        },
      ],
    ]);

    expect(result.totalOutcomes).toEqual({
      commitCount: 1,
      linesAdded: 4,
      linesDeleted: 2,
      linesChanged: 6,
    });
    expect(result.diagnostics.includeMergeCommits).toBe(false);
    expect(result.diagnostics.commitsCollected).toBe(1);
  });

  it('omits --no-merges when includeMergeCommits is enabled', async () => {
    const runGitCommand = vi.fn<
      (
        repoDir: string,
        args: string[],
      ) => Promise<{ lines: string[]; stderr: string; exitCode: number }>
    >(async (_repoDir, args) => {
      if (args[0] === 'config') {
        return {
          lines: ['dev@example.com'],
          stderr: '',
          exitCode: 0,
        };
      }

      return {
        lines: [`${marker}1770771600${marker}abcdef2${marker}dev@example.com`],
        stderr: '',
        exitCode: 0,
      };
    });

    await collectGitOutcomes(
      {
        repoDir: '/tmp/repo',
        granularity: 'daily',
        timezone: 'UTC',
        includeMergeCommits: true,
      },
      { runGitCommand },
    );

    const args = (runGitCommand.mock.calls[1]?.[1] as string[] | undefined) ?? [];
    expect(args).not.toContain('--no-merges');
    expect(args).toContain('--author=<dev@example.com>');
  });

  it('fails when user.email is missing', async () => {
    const runGitCommand = vi.fn<
      (
        repoDir: string,
        args: string[],
      ) => Promise<{ lines: string[]; stderr: string; exitCode: number }>
    >(async () => ({
      lines: [],
      stderr: '',
      exitCode: 1,
    }));

    await expect(
      collectGitOutcomes(
        {
          repoDir: '/tmp/repo',
          granularity: 'daily',
          timezone: 'UTC',
        },
        { runGitCommand },
      ),
    ).rejects.toThrow('Git user.email is not configured for');
  });
});
