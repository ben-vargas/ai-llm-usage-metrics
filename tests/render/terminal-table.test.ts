import { describe, expect, it } from 'vitest';

import type { UsageReportRow } from '../../src/domain/usage-report-row.js';
import { renderTerminalTable } from '../../src/render/terminal-table.js';

const sampleRows: UsageReportRow[] = [
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

describe('renderTerminalTable', () => {
  it('renders rows with stable columns and aligned numeric values', () => {
    const rendered = renderTerminalTable(sampleRows, { useColor: false });

    expect(rendered).toMatchInlineSnapshot(`
      "╭────────────┬──────────┬──────────────────────────────────┬───────┬────────┬───────────┬────────────┬─────────────┬───────┬───────╮
      │ Period     │ Source   │ Models                           │ Input │ Output │ Reasoning │ Cache Read │ Cache Write │ Total │  Cost │
      ├────────────┼──────────┼──────────────────────────────────┼───────┼────────┼───────────┼────────────┼─────────────┼───────┼───────┤
      │ 2026-02-10 │ pi       │ • gpt-4.1                        │ 1,234 │    321 │         0 │         30 │           0 │ 1,585 │ $1.25 │
      │ 2026-02-10 │ combined │ • gpt-4.1                        │ 2,000 │    500 │       120 │        100 │           0 │ 2,720 │ $2.75 │
      │            │          │ • gpt-5-codex                    │       │        │           │            │             │       │       │
      ├────────────┼──────────┼──────────────────────────────────┼───────┼────────┼───────────┼────────────┼─────────────┼───────┼───────┤
      │ ALL        │ TOTAL    │ • gpt-4.1                        │ 2,000 │    500 │       120 │        100 │           0 │ 2,720 │ $2.75 │
      │            │          │ • gpt-5-codex                    │       │        │           │            │             │       │       │
      ╰────────────┴──────────┴──────────────────────────────────┴───────┴────────┴───────────┴────────────┴─────────────┴───────┴───────╯
      "
    `);
    expect(rendered.includes(`${String.fromCharCode(27)}[`)).toBe(false);
  });

  it('keeps structural separators stable when color is enabled', () => {
    const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'gu');
    const stripAnsi = (value: string) => value.replaceAll(ansiPattern, '');

    const uncolored = renderTerminalTable(sampleRows, { useColor: false });
    const colored = renderTerminalTable(sampleRows, { useColor: true });

    expect(stripAnsi(colored)).toBe(uncolored);
  });

  it('keeps unknown sources unchanged and still renders output', () => {
    const rendered = renderTerminalTable(
      [
        {
          rowType: 'period_source',
          periodKey: '2026-02-10',
          source: 'pi',
          models: ['gpt-4.1'],
          inputTokens: 1,
          outputTokens: 1,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 2,
          costUsd: 0.01,
        },
        {
          rowType: 'period_source',
          periodKey: '2026-02-10',
          source: 'other' as UsageReportRow['source'],
          models: ['x-model'],
          inputTokens: 2,
          outputTokens: 2,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 4,
          costUsd: 0.02,
        },
        {
          rowType: 'grand_total',
          periodKey: 'ALL',
          source: 'combined',
          models: ['gpt-4.1', 'x-model'],
          inputTokens: 3,
          outputTokens: 3,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 6,
          costUsd: 0.03,
        },
      ],
      { useColor: false },
    );

    expect(rendered).toContain(' other ');
    expect(rendered).toContain(' x-model ');
  });
});
