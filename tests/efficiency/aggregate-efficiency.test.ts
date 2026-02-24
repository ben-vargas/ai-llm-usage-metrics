import { describe, expect, it } from 'vitest';

import { aggregateEfficiency } from '../../src/efficiency/aggregate-efficiency.js';
import type { EfficiencyOutcomeTotals } from '../../src/efficiency/efficiency-row.js';
import type { UsageReportRow } from '../../src/domain/usage-report-row.js';

function createUsageRow(overrides: Partial<UsageReportRow>): UsageReportRow {
  return {
    rowType: 'period_source',
    periodKey: '2026-02-01',
    source: 'pi',
    models: [],
    modelBreakdown: [],
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    ...overrides,
  } as UsageReportRow;
}

describe('aggregateEfficiency', () => {
  it('prefers combined usage rows and joins with outcome periods', () => {
    const usageRows: UsageReportRow[] = [
      createUsageRow({
        rowType: 'period_source',
        periodKey: '2026-02-01',
        source: 'pi',
        inputTokens: 100,
        totalTokens: 100,
        costUsd: 1,
      }),
      createUsageRow({
        rowType: 'period_source',
        periodKey: '2026-02-01',
        source: 'codex',
        inputTokens: 200,
        totalTokens: 200,
        costUsd: 2,
      }),
      createUsageRow({
        rowType: 'period_combined',
        periodKey: '2026-02-01',
        source: 'combined',
        inputTokens: 300,
        totalTokens: 300,
        costUsd: 3,
      }),
      createUsageRow({
        rowType: 'period_source',
        periodKey: '2026-02-02',
        source: 'pi',
        inputTokens: 50,
        totalTokens: 50,
        costUsd: 0.5,
      }),
      createUsageRow({
        rowType: 'grand_total',
        periodKey: 'ALL',
        source: 'combined',
        inputTokens: 350,
        totalTokens: 350,
        costUsd: 3.5,
      }),
    ];

    const periodOutcomes = new Map<string, EfficiencyOutcomeTotals>([
      [
        '2026-02-01',
        {
          commitCount: 2,
          linesAdded: 80,
          linesDeleted: 20,
          linesChanged: 100,
        },
      ],
      [
        '2026-02-03',
        {
          commitCount: 1,
          linesAdded: 10,
          linesDeleted: 0,
          linesChanged: 10,
        },
      ],
    ]);

    const rows = aggregateEfficiency({
      usageRows,
      periodOutcomes,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rowType: 'period',
      periodKey: '2026-02-01',
      inputTokens: 300,
      totalTokens: 300,
      costUsd: 3,
      commitCount: 2,
      linesChanged: 100,
      usdPerCommit: 1.5,
      tokensPerCommit: 150,
      nonCacheTokensPerCommit: 150,
      commitsPerUsd: 2 / 3,
    });
    expect(rows[1]).toMatchObject({
      rowType: 'grand_total',
      periodKey: 'ALL',
      inputTokens: 300,
      totalTokens: 300,
      costUsd: 3,
      commitCount: 2,
      linesChanged: 100,
      tokensPerCommit: 150,
      nonCacheTokensPerCommit: 150,
    });
  });

  it('returns a zero grand total row when no usage and outcomes are present', () => {
    const rows = aggregateEfficiency({
      usageRows: [
        createUsageRow({
          rowType: 'grand_total',
          periodKey: 'ALL',
          source: 'combined',
          inputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
        }),
      ],
      periodOutcomes: new Map(),
    });

    expect(rows).toEqual([
      {
        rowType: 'grand_total',
        periodKey: 'ALL',
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        commitCount: 0,
        linesAdded: 0,
        linesDeleted: 0,
        linesChanged: 0,
        usdPerCommit: undefined,
        usdPer1kLinesChanged: undefined,
        tokensPerCommit: undefined,
        nonCacheTokensPerCommit: undefined,
        commitsPerUsd: undefined,
      },
    ]);
  });

  it('sums period_source rows when a combined row is not present', () => {
    const rows = aggregateEfficiency({
      usageRows: [
        createUsageRow({
          rowType: 'period_source',
          periodKey: '2026-02-01',
          source: 'pi',
          inputTokens: 40,
          outputTokens: 10,
          totalTokens: 50,
          costUsd: 0.5,
        }),
        createUsageRow({
          rowType: 'period_source',
          periodKey: '2026-02-01',
          source: 'codex',
          inputTokens: 30,
          outputTokens: 20,
          totalTokens: 50,
          costUsd: 0.25,
        }),
        createUsageRow({
          rowType: 'grand_total',
          periodKey: 'ALL',
          source: 'combined',
          inputTokens: 70,
          outputTokens: 30,
          totalTokens: 100,
          costUsd: 0.75,
        }),
      ],
      periodOutcomes: new Map([
        [
          '2026-02-01',
          {
            commitCount: 2,
            linesAdded: 15,
            linesDeleted: 5,
            linesChanged: 20,
          },
        ],
      ]),
    });

    expect(rows[0]).toMatchObject({
      rowType: 'period',
      periodKey: '2026-02-01',
      inputTokens: 70,
      outputTokens: 30,
      totalTokens: 100,
      costUsd: 0.75,
      commitCount: 2,
      usdPerCommit: 0.375,
    });
  });

  it('keeps cost-derived metrics undefined when costs are incomplete and unresolved', () => {
    const rows = aggregateEfficiency({
      usageRows: [
        createUsageRow({
          rowType: 'period_source',
          periodKey: '2026-02-01',
          source: 'pi',
          inputTokens: 100,
          totalTokens: 100,
          costUsd: undefined,
          costIncomplete: true,
        }),
        createUsageRow({
          rowType: 'grand_total',
          periodKey: 'ALL',
          source: 'combined',
          inputTokens: 100,
          totalTokens: 100,
          costUsd: undefined,
          costIncomplete: true,
        }),
      ],
      periodOutcomes: new Map([
        [
          '2026-02-01',
          {
            commitCount: 2,
            linesAdded: 12,
            linesDeleted: 2,
            linesChanged: 14,
          },
        ],
      ]),
    });

    expect(rows[0]).toMatchObject({
      rowType: 'period',
      costUsd: undefined,
      costIncomplete: true,
      usdPerCommit: undefined,
      usdPer1kLinesChanged: undefined,
      commitsPerUsd: undefined,
      tokensPerCommit: 50,
      nonCacheTokensPerCommit: 50,
    });

    expect(rows[1]).toMatchObject({
      rowType: 'grand_total',
      costUsd: undefined,
      costIncomplete: true,
      usdPerCommit: undefined,
      usdPer1kLinesChanged: undefined,
      commitsPerUsd: undefined,
      tokensPerCommit: 50,
      nonCacheTokensPerCommit: 50,
    });
  });
});
