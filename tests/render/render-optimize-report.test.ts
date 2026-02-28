import { describe, expect, it } from 'vitest';

import type { OptimizeDataResult } from '../../src/cli/usage-data-contracts.js';
import { renderOptimizeReport } from '../../src/render/render-optimize-report.js';
import { visibleWidth } from '../../src/render/table-text-layout.js';

function createOptimizeDataResult(): OptimizeDataResult {
  return {
    rows: [
      {
        rowType: 'baseline',
        periodKey: '2026-02-10',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 150,
        baselineCostUsd: 1.25,
        baselineCostIncomplete: false,
      },
      {
        rowType: 'candidate',
        periodKey: '2026-02-10',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 150,
        candidateModel: 'gpt-4.1',
        candidateResolvedModel: 'gpt-4.1',
        hypotheticalCostUsd: 1.1,
        hypotheticalCostIncomplete: false,
        savingsUsd: 0.15,
        savingsPct: 0.12,
        notes: ['baseline_incomplete'],
      },
      {
        rowType: 'baseline',
        periodKey: 'ALL',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 150,
        baselineCostUsd: 1.25,
        baselineCostIncomplete: false,
      },
      {
        rowType: 'candidate',
        periodKey: 'ALL',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 150,
        candidateModel: 'gpt-4.1',
        candidateResolvedModel: 'gpt-4.1',
        hypotheticalCostUsd: 1.1,
        hypotheticalCostIncomplete: false,
        savingsUsd: 0.15,
        savingsPct: 0.12,
      },
    ],
    diagnostics: {
      usage: {
        sessionStats: [],
        sourceFailures: [],
        skippedRows: [],
        pricingOrigin: 'cache',
        activeEnvOverrides: [],
        timezone: 'UTC',
      },
      provider: 'openai',
      baselineCostIncomplete: false,
      candidatesWithMissingPricing: [],
    },
  };
}

describe('renderOptimizeReport', () => {
  it('renders terminal output with title and optimize columns', () => {
    const output = renderOptimizeReport(createOptimizeDataResult(), 'terminal', {
      granularity: 'weekly',
      useColor: false,
    });

    expect(output).toContain('Weekly Optimize Report');
    expect(output).toContain('│ Period');
    expect(output).toContain('│ Candidate');
    expect(output).toContain('│ Hypothetical Cost');
  });

  it('keeps terminal table borders aligned with long candidate names', () => {
    const data = createOptimizeDataResult();
    data.rows = data.rows.map((row) =>
      row.rowType === 'candidate'
        ? {
            ...row,
            candidateModel: 'a-very-long-candidate-model-name',
          }
        : row,
    );

    const output = renderOptimizeReport(data, 'terminal', {
      granularity: 'daily',
      useColor: false,
    });

    const firstTableLineIndex = output.split('\n').findIndex((line) => line.startsWith('╭'));
    const tableSection =
      firstTableLineIndex >= 0 ? output.split('\n').slice(firstTableLineIndex) : [];
    const tableLines = tableSection.filter((line) => /[│╭╮╰╯├┼┬┴]/u.test(line));
    const renderedWidths = [...new Set(tableLines.map((line) => visibleWidth(line)))];

    expect(renderedWidths).toHaveLength(1);
  });

  it('renders markdown output with candidate column', () => {
    const output = renderOptimizeReport(createOptimizeDataResult(), 'markdown', {
      granularity: 'daily',
    });

    expect(output).toContain('| Candidate');
    expect(output).toContain('| BASELINE');
    expect(output).toContain('| gpt-4.1');
  });

  it('renders JSON output as rows only', () => {
    const output = renderOptimizeReport(createOptimizeDataResult(), 'json', {
      granularity: 'monthly',
    });

    const parsed = JSON.parse(output) as Array<{ rowType: string; periodKey: string }>;

    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toMatchObject({ rowType: 'baseline', periodKey: '2026-02-10' });
    expect(parsed[3]).toMatchObject({ rowType: 'candidate', periodKey: 'ALL' });
  });
});
