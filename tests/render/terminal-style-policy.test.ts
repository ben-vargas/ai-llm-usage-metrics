import { describe, expect, it } from 'vitest';

import {
  applyRowTypeStyle,
  colorizeUsageBodyRows,
  resolveSourceStyler,
  type TerminalStylePalette,
} from '../../src/render/terminal-style-policy.js';
import type { UsageReportRow } from '../../src/domain/usage-report-row.js';

const testPalette: TerminalStylePalette = {
  cyan: (text) => `<cyan>${text}</cyan>`,
  magenta: (text) => `<magenta>${text}</magenta>`,
  blue: (text) => `<blue>${text}</blue>`,
  yellow: (text) => `<yellow>${text}</yellow>`,
  green: (text) => `<green>${text}</green>`,
  white: (text) => `<white>${text}</white>`,
  bold: (text) => `<bold>${text}</bold>`,
  dim: (text) => `<dim>${text}</dim>`,
};

describe('terminal-style-policy', () => {
  it('resolves source stylers for known sources and fallback', () => {
    expect(resolveSourceStyler('pi', testPalette)('pi')).toBe('<cyan>pi</cyan>');
    expect(resolveSourceStyler('codex', testPalette)('codex')).toBe('<magenta>codex</magenta>');
    expect(resolveSourceStyler('opencode', testPalette)('opencode')).toBe('<blue>opencode</blue>');
    expect(resolveSourceStyler('combined', testPalette)('combined')).toBe(
      '<yellow>combined</yellow>',
    );
    expect(resolveSourceStyler('TOTAL', testPalette)('TOTAL')).toBe(
      '<bold><green>TOTAL</green></bold>',
    );
    expect(resolveSourceStyler('other', testPalette)('other')).toBe('other');
  });

  it('applies row-type style policy for period_source rows', () => {
    const styled = applyRowTypeStyle(
      'period_source',
      ['period', 'pi', 'model', '1', '2', '3', '4', '5', '6', '$7'],
      testPalette,
    );

    expect(styled).toEqual([
      'period',
      'pi',
      'model',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '<yellow>$7</yellow>',
    ]);
  });

  it('applies row-type style policy for period_combined rows', () => {
    const styled = applyRowTypeStyle(
      'period_combined',
      ['period', '<yellow>combined</yellow>', 'model', '1'],
      testPalette,
    );

    expect(styled).toEqual([
      '<dim>period</dim>',
      '<bold><yellow>combined</yellow></bold>',
      '<dim>model</dim>',
      '<dim>1</dim>',
    ]);
  });

  it('applies row-type style policy for grand_total rows', () => {
    const styled = applyRowTypeStyle(
      'grand_total',
      ['ALL', '<bold>TOTAL</bold>', 'model', '1'],
      testPalette,
    );

    expect(styled).toEqual([
      '<bold><white>ALL</white></bold>',
      '<bold>TOTAL</bold>',
      '<bold>model</bold>',
      '<bold>1</bold>',
    ]);
  });

  it('returns plain body rows when color is disabled', () => {
    const bodyRows = [['period', 'pi', 'model', '$1']];
    const rows: UsageReportRow[] = [
      {
        rowType: 'period_source',
        periodKey: 'period',
        source: 'pi',
        models: ['model'],
        modelBreakdown: [
          {
            model: 'model',
            inputTokens: 1,
            outputTokens: 1,
            reasoningTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 2,
            costUsd: 1,
          },
        ],
        inputTokens: 1,
        outputTokens: 1,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 2,
        costUsd: 1,
      },
    ];

    expect(
      colorizeUsageBodyRows(bodyRows, rows, { useColor: false, palette: testPalette }),
    ).toEqual(bodyRows);
  });

  it('handles unexpectedly short cells arrays without throwing', () => {
    const bodyRows = [['$1']];
    const rows: UsageReportRow[] = [
      {
        rowType: 'period_source',
        periodKey: 'period',
        source: 'pi',
        models: ['model'],
        modelBreakdown: [
          {
            model: 'model',
            inputTokens: 1,
            outputTokens: 1,
            reasoningTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 2,
            costUsd: 1,
          },
        ],
        inputTokens: 1,
        outputTokens: 1,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 2,
        costUsd: 1,
      },
    ];

    expect(colorizeUsageBodyRows(bodyRows, rows, { useColor: true, palette: testPalette })).toEqual(
      [['<yellow>$1</yellow>']],
    );
  });

  it('keeps unknown source labels unchanged while still applying row-type policy', () => {
    const bodyRows = [['period', 'other', 'model', '$1']];
    const rows: UsageReportRow[] = [
      {
        rowType: 'period_source',
        periodKey: 'period',
        source: 'other' as UsageReportRow['source'],
        models: ['model'],
        modelBreakdown: [
          {
            model: 'model',
            inputTokens: 1,
            outputTokens: 1,
            reasoningTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 2,
            costUsd: 1,
          },
        ],
        inputTokens: 1,
        outputTokens: 1,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 2,
        costUsd: 1,
      },
    ];

    const styledRows = colorizeUsageBodyRows(bodyRows, rows, {
      useColor: true,
      palette: testPalette,
    });

    expect(styledRows[0]).toEqual([
      '<white>period</white>',
      'other',
      'model',
      '<yellow>$1</yellow>',
    ]);
  });
});
