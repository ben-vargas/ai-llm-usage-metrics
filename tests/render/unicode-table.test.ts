import { describe, expect, it } from 'vitest';

import type { UsageReportRow } from '../../src/domain/usage-report-row.js';
import { renderUnicodeTable } from '../../src/render/unicode-table.js';

function createUsageRow(overrides: Partial<UsageReportRow> = {}): UsageReportRow {
  return {
    rowType: 'period_source',
    periodKey: '2026-02-22',
    source: 'pi',
    models: ['gpt-4.1'],
    modelBreakdown: [],
    inputTokens: 1,
    outputTokens: 1,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 2,
    costUsd: 0.01,
    ...overrides,
  } as UsageReportRow;
}

describe('renderUnicodeTable', () => {
  it('pads missing body/measure rows when usage row counts are misaligned', () => {
    const rendered = renderUnicodeTable({
      headerCells: ['Period', 'Source'],
      bodyRows: [],
      measureHeaderCells: ['Period', 'Source'],
      measureBodyRows: [],
      usageRows: [createUsageRow()],
      tableLayout: 'compact',
      modelsColumnIndex: 1,
      modelsColumnWidth: 12,
    });

    expect(rendered).toContain('╭');
    expect(rendered).toContain('╰');
  });

  it('pads short body rows so splitCellLines always receives strings', () => {
    const rendered = renderUnicodeTable({
      headerCells: ['Period', 'Source'],
      bodyRows: [['2026-02-22']],
      measureHeaderCells: ['Period', 'Source'],
      measureBodyRows: [['2026-02-22']],
      usageRows: [createUsageRow()],
      tableLayout: 'compact',
      modelsColumnIndex: 1,
      modelsColumnWidth: 12,
    });

    expect(rendered).toContain('2026-02-22');
  });

  it('uses max column count across rows to keep later wider rows aligned', () => {
    const rendered = renderUnicodeTable({
      headerCells: ['Period', 'Source'],
      bodyRows: [
        ['2026-02-22', 'pi'],
        ['2026-02-22', 'opencode', 'extra-cell'],
      ],
      measureHeaderCells: ['Period', 'Source'],
      measureBodyRows: [
        ['2026-02-22', 'pi'],
        ['2026-02-22', 'opencode', 'extra-cell'],
      ],
      usageRows: [createUsageRow(), createUsageRow({ source: 'opencode' })],
      tableLayout: 'compact',
      modelsColumnIndex: 1,
      modelsColumnWidth: 12,
    });

    expect(rendered).toContain('extra-cell');
  });

  it('uses a shared column count when body has more columns than measure rows', () => {
    const rendered = renderUnicodeTable({
      headerCells: ['Period', 'Source'],
      bodyRows: [['2026-02-22', 'opencode', 'extra']],
      measureHeaderCells: ['Period', 'Source'],
      measureBodyRows: [['2026-02-22', 'opencode']],
      usageRows: [createUsageRow({ source: 'opencode' })],
      tableLayout: 'compact',
      modelsColumnIndex: 1,
      modelsColumnWidth: 12,
    });
    const topBorder = rendered.split('\n')[0] ?? '';

    expect((topBorder.match(/┬/g) ?? []).length).toBe(2);
    expect(rendered).not.toContain('undefined');
  });
});
