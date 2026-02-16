import { describe, expect, it } from 'vitest';

import type { UsageReportRow } from '../../src/domain/usage-report-row.js';
import { renderTerminalTable } from '../../src/render/terminal-table.js';

describe('renderTerminalTable', () => {
  it('renders rows with stable columns and aligned numeric values', () => {
    const rows: UsageReportRow[] = [
      {
        rowType: 'period_source',
        periodKey: '2026-02-10',
        source: 'pi',
        models: ['gpt-4.1'],
        inputTokens: 1234,
        outputTokens: 321,
        reasoningTokens: 0,
        cacheReadTokens: 30,
        cacheWriteTokens: 0,
        totalTokens: 1585,
        costUsd: 1.25,
      },
      {
        rowType: 'period_combined',
        periodKey: '2026-02-10',
        source: 'combined',
        models: ['gpt-4.1', 'gpt-5-codex'],
        inputTokens: 2000,
        outputTokens: 500,
        reasoningTokens: 120,
        cacheReadTokens: 100,
        cacheWriteTokens: 0,
        totalTokens: 2720,
        costUsd: 2.75,
      },
      {
        rowType: 'grand_total',
        periodKey: 'ALL',
        source: 'combined',
        models: ['gpt-4.1', 'gpt-5-codex'],
        inputTokens: 2000,
        outputTokens: 500,
        reasoningTokens: 120,
        cacheReadTokens: 100,
        cacheWriteTokens: 0,
        totalTokens: 2720,
        costUsd: 2.75,
      },
    ];

    const rendered = renderTerminalTable(rows);

    expect(rendered).toMatchInlineSnapshot(`
      "┌────────────┬──────────┬────────────────────────────────────┬───────┬────────┬───────────┬────────────┬──────────────┬────────────┐
      │ Period     │ Source   │ Models                             │ Input │ Output │ Reasoning │ Cache Read │ Total Tokens │ Cost (USD) │
      ├────────────┼──────────┼────────────────────────────────────┼───────┼────────┼───────────┼────────────┼──────────────┼────────────┤
      │ 2026-02-10 │ pi       │ gpt-4.1                            │ 1,234 │    321 │         0 │         30 │        1,585 │     1.2500 │
      │ 2026-02-10 │ combined │ gpt-4.1, gpt-5-codex               │ 2,000 │    500 │       120 │        100 │        2,720 │     2.7500 │
      ├────────────┼──────────┼────────────────────────────────────┼───────┼────────┼───────────┼────────────┼──────────────┼────────────┤
      │ ALL        │ TOTAL    │ gpt-4.1, gpt-5-codex               │ 2,000 │    500 │       120 │        100 │        2,720 │     2.7500 │
      └────────────┴──────────┴────────────────────────────────────┴───────┴────────┴───────────┴────────────┴──────────────┴────────────┘
      "
    `);
  });
});
