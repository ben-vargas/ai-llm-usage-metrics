import { describe, expect, it, vi } from 'vitest';

import { buildEfficiencyData } from '../../src/cli/build-efficiency-data.js';
import type { UsageDataResult } from '../../src/cli/usage-data-contracts.js';

function createUsageDataResult(): UsageDataResult {
  return {
    // Intentionally includes multiple repo-scoped events so buildEfficiencyData
    // is forced to re-aggregate from attributed events (not trust incoming rows).
    events: [
      {
        source: 'pi',
        sessionId: 'pi-session-1',
        timestamp: '2026-02-11T12:00:00.000Z',
        repoRoot: '/workspace/repo-a/app',
        provider: 'openai',
        model: 'gpt-4.1',
        inputTokens: 120,
        outputTokens: 80,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 200,
        costUsd: 2,
        costMode: 'explicit',
      },
      {
        source: 'opencode',
        sessionId: 'opencode-session-1',
        timestamp: '2026-02-11T12:05:00.000Z',
        repoRoot: '/workspace/repo-b',
        provider: 'github-copilot',
        model: 'claude-opus-4.6',
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 150,
        costUsd: 1.5,
        costMode: 'explicit',
      },
      {
        source: 'codex',
        sessionId: 'codex-session-1',
        timestamp: '2026-02-11T12:10:00.000Z',
        provider: 'openai',
        model: 'gpt-5.3-codex',
        inputTokens: 60,
        outputTokens: 40,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 100,
        costUsd: 1,
        costMode: 'explicit',
      },
    ],
    // Intentionally only mirrors the pi slice so tests verify rows are rebuilt
    // from attribution, not reused from this precomputed usage summary.
    rows: [
      {
        rowType: 'period_source',
        periodKey: '2026-02-11',
        source: 'pi',
        models: [],
        modelBreakdown: [],
        inputTokens: 120,
        outputTokens: 80,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 200,
        costUsd: 2,
      },
      {
        rowType: 'grand_total',
        periodKey: 'ALL',
        source: 'combined',
        models: [],
        modelBreakdown: [],
        inputTokens: 120,
        outputTokens: 80,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 200,
        costUsd: 2,
      },
    ],
    diagnostics: {
      sessionStats: [{ source: 'pi', filesFound: 1, eventsParsed: 1 }],
      sourceFailures: [],
      skippedRows: [],
      pricingOrigin: 'cache',
      activeEnvOverrides: [],
      timezone: 'Europe/Paris',
    },
  };
}

describe('buildEfficiencyData', () => {
  it('builds efficiency rows and propagates scope diagnostics', async () => {
    const buildUsageDataMock = vi.fn(async () => createUsageDataResult());
    const collectGitOutcomesMock = vi.fn(async () => ({
      periodOutcomes: new Map([
        [
          '2026-02-11',
          {
            commitCount: 2,
            linesAdded: 60,
            linesDeleted: 20,
            linesChanged: 80,
          },
        ],
      ]),
      totalOutcomes: {
        commitCount: 2,
        linesAdded: 60,
        linesDeleted: 20,
        linesChanged: 80,
      },
      diagnostics: {
        repoDir: '/tmp/repo',
        includeMergeCommits: false,
        commitsCollected: 2,
        linesAdded: 60,
        linesDeleted: 20,
      },
    }));

    const result = await buildEfficiencyData(
      'daily',
      {
        source: 'pi',
        provider: 'openai',
        model: 'gpt-4.1',
      },
      {
        buildUsageData: buildUsageDataMock,
        collectGitOutcomes: collectGitOutcomesMock,
        resolveRepoRoot: async (pathHint) => {
          if (pathHint === '/workspace/repo-a/app') {
            return '/tmp/repo';
          }

          if (pathHint === '/workspace/repo-b') {
            return '/tmp/other-repo';
          }

          return undefined;
        },
      },
    );

    expect(buildUsageDataMock).toHaveBeenCalledWith('daily', {
      source: 'pi',
      provider: 'openai',
      model: 'gpt-4.1',
    });

    expect(collectGitOutcomesMock).toHaveBeenCalledWith({
      repoDir: undefined,
      granularity: 'daily',
      timezone: 'Europe/Paris',
      since: undefined,
      until: undefined,
      includeMergeCommits: undefined,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      rowType: 'period',
      periodKey: '2026-02-11',
      totalTokens: 200,
      commitCount: 2,
      tokensPerCommit: 100,
    });

    expect(result.diagnostics).toMatchObject({
      repoDir: '/tmp/repo',
      includeMergeCommits: false,
      gitCommitCount: 2,
      gitLinesAdded: 60,
      gitLinesDeleted: 20,
      repoMatchedUsageEvents: 1,
      repoExcludedUsageEvents: 1,
      repoUnattributedUsageEvents: 1,
    });
    expect(result.diagnostics.scopeNote).toContain('Usage filters (--source, --provider, --model)');
  });

  it('omits scope note when no usage-only filters are active', async () => {
    const result = await buildEfficiencyData(
      'weekly',
      {},
      {
        buildUsageData: async () => createUsageDataResult(),
        collectGitOutcomes: async () => ({
          periodOutcomes: new Map(),
          totalOutcomes: {
            commitCount: 0,
            linesAdded: 0,
            linesDeleted: 0,
            linesChanged: 0,
          },
          diagnostics: {
            repoDir: '/tmp/repo',
            includeMergeCommits: false,
            commitsCollected: 0,
            linesAdded: 0,
            linesDeleted: 0,
          },
        }),
        resolveRepoRoot: async () => '/tmp/repo',
      },
    );

    expect(result.diagnostics.scopeNote).toBeUndefined();
    expect(result.diagnostics.repoMatchedUsageEvents).toBe(2);
  });

  it('emits scope note for usage-source overrides beyond source/provider/model filters', async () => {
    const result = await buildEfficiencyData(
      'monthly',
      {
        piDir: '/tmp/pi',
        sourceDir: ['codex=/tmp/codex'],
      },
      {
        buildUsageData: async () => createUsageDataResult(),
        collectGitOutcomes: async () => ({
          periodOutcomes: new Map(),
          totalOutcomes: {
            commitCount: 0,
            linesAdded: 0,
            linesDeleted: 0,
            linesChanged: 0,
          },
          diagnostics: {
            repoDir: '/tmp/repo',
            includeMergeCommits: false,
            commitsCollected: 0,
            linesAdded: 0,
            linesDeleted: 0,
          },
        }),
        resolveRepoRoot: async () => '/tmp/repo',
      },
    );

    expect(result.diagnostics.scopeNote).toContain('--pi-dir');
    expect(result.diagnostics.scopeNote).toContain('--source-dir');
  });

  it('includes --opencode-db in scope note when configured', async () => {
    const result = await buildEfficiencyData(
      'monthly',
      {
        opencodeDb: '/tmp/opencode.db',
      },
      {
        buildUsageData: async () => createUsageDataResult(),
        collectGitOutcomes: async () => ({
          periodOutcomes: new Map(),
          totalOutcomes: {
            commitCount: 0,
            linesAdded: 0,
            linesDeleted: 0,
            linesChanged: 0,
          },
          diagnostics: {
            repoDir: '/tmp/repo',
            includeMergeCommits: false,
            commitsCollected: 0,
            linesAdded: 0,
            linesDeleted: 0,
          },
        }),
        resolveRepoRoot: async () => '/tmp/repo',
      },
    );

    expect(result.diagnostics.scopeNote).toContain('--opencode-db');
  });
});
