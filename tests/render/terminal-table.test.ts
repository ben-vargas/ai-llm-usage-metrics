import { describe, expect, it } from 'vitest';

import type { UsageReportRow } from '../../src/domain/usage-report-row.js';
import { renderTerminalTable } from '../../src/render/terminal-table.js';

const sampleRows: UsageReportRow[] = [
  {
    rowType: 'period_source',
    periodKey: '2026-02-10',
    source: 'pi',
    models: ['gpt-4.1'],
    modelBreakdown: [
      {
        model: 'gpt-4.1',
        inputTokens: 1234,
        outputTokens: 321,
        reasoningTokens: 0,
        cacheReadTokens: 30,
        cacheWriteTokens: 0,
        totalTokens: 1585,
        costUsd: 1.25,
      },
    ],
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
    modelBreakdown: [
      {
        model: 'gpt-4.1',
        inputTokens: 1234,
        outputTokens: 321,
        reasoningTokens: 0,
        cacheReadTokens: 30,
        cacheWriteTokens: 0,
        totalTokens: 1585,
        costUsd: 1.25,
      },
      {
        model: 'gpt-5-codex',
        inputTokens: 766,
        outputTokens: 179,
        reasoningTokens: 120,
        cacheReadTokens: 70,
        cacheWriteTokens: 0,
        totalTokens: 1135,
        costUsd: 1.5,
      },
    ],
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
    modelBreakdown: [
      {
        model: 'gpt-4.1',
        inputTokens: 1234,
        outputTokens: 321,
        reasoningTokens: 0,
        cacheReadTokens: 30,
        cacheWriteTokens: 0,
        totalTokens: 1585,
        costUsd: 1.25,
      },
      {
        model: 'gpt-5-codex',
        inputTokens: 766,
        outputTokens: 179,
        reasoningTokens: 120,
        cacheReadTokens: 70,
        cacheWriteTokens: 0,
        totalTokens: 1135,
        costUsd: 1.5,
      },
    ],
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
  it('renders compact model names by default', () => {
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
    expect(rendered).toContain('• gpt-4.1');
    expect(rendered).not.toContain('tok, $');
    expect(rendered.includes(`${String.fromCharCode(27)}[`)).toBe(false);
  });

  it('renders per-model aligned columns when enabled', () => {
    const rendered = renderTerminalTable(sampleRows, {
      useColor: false,
      tableLayout: 'per_model_columns',
    });

    expect(rendered).toMatchInlineSnapshot(`
      "╭────────────┬──────────┬──────────────────────────────────┬───────┬────────┬───────────┬────────────┬─────────────┬───────┬───────╮
      │ Period     │ Source   │ Models                           │ Input │ Output │ Reasoning │ Cache Read │ Cache Write │ Total │  Cost │
      ├────────────┼──────────┼──────────────────────────────────┼───────┼────────┼───────────┼────────────┼─────────────┼───────┼───────┤
      │ 2026-02-10 │ pi       │ • gpt-4.1                        │ 1,234 │    321 │         0 │         30 │           0 │ 1,585 │ $1.25 │
      │ 2026-02-10 │ combined │ • gpt-4.1                        │ 1,234 │    321 │         0 │         30 │           0 │ 1,585 │ $1.25 │
      │            │          │ • gpt-5-codex                    │   766 │    179 │       120 │         70 │           0 │ 1,135 │ $1.50 │
      │            │          │ Σ TOTAL                          │ 2,000 │    500 │       120 │        100 │           0 │ 2,720 │ $2.75 │
      ├────────────┼──────────┼──────────────────────────────────┼───────┼────────┼───────────┼────────────┼─────────────┼───────┼───────┤
      │ ALL        │ TOTAL    │ • gpt-4.1                        │ 1,234 │    321 │         0 │         30 │           0 │ 1,585 │ $1.25 │
      │            │          │ • gpt-5-codex                    │   766 │    179 │       120 │         70 │           0 │ 1,135 │ $1.50 │
      │            │          │ Σ TOTAL                          │ 2,000 │    500 │       120 │        100 │           0 │ 2,720 │ $2.75 │
      ╰────────────┴──────────┴──────────────────────────────────┴───────┴────────┴───────────┴────────────┴─────────────┴───────┴───────╯
      "
    `);
    expect(rendered).toContain('Σ TOTAL');
    expect(rendered).toContain('│   766 │    179 │       120 │         70 │');
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
          modelBreakdown: [
            {
              model: 'gpt-4.1',
              inputTokens: 1,
              outputTokens: 1,
              reasoningTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 2,
              costUsd: 0.01,
            },
          ],
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
          modelBreakdown: [
            {
              model: 'x-model',
              inputTokens: 2,
              outputTokens: 2,
              reasoningTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 4,
              costUsd: 0.02,
            },
          ],
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
          modelBreakdown: [
            {
              model: 'gpt-4.1',
              inputTokens: 1,
              outputTokens: 1,
              reasoningTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 2,
              costUsd: 0.01,
            },
            {
              model: 'x-model',
              inputTokens: 2,
              outputTokens: 2,
              reasoningTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 4,
              costUsd: 0.02,
            },
          ],
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
