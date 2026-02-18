import { describe, expect, it } from 'vitest';

import type { UsageDataResult } from '../../src/cli/usage-data-contracts.js';
import { renderUsageReport } from '../../src/render/render-usage-report.js';

const sampleUsageData: UsageDataResult = {
  rows: [
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
  ],
  diagnostics: {
    sessionStats: [
      { source: 'pi', filesFound: 1, eventsParsed: 2 },
      { source: 'codex', filesFound: 1, eventsParsed: 2 },
    ],
    pricingOrigin: 'cache',
    activeEnvOverrides: [
      {
        name: 'LLM_USAGE_PARSE_MAX_PARALLEL',
        value: '8',
        description: 'max parallel file parsing',
      },
    ],
    timezone: 'UTC',
  },
};

describe('renderUsageReport', () => {
  it('renders terminal output with override section, header and table in order', () => {
    const rendered = renderUsageReport(sampleUsageData, 'terminal', {
      granularity: 'monthly',
      useColor: false,
    });

    expect(rendered).toContain('Active environment overrides:');
    expect(rendered).toContain('LLM_USAGE_PARSE_MAX_PARALLEL=8');
    expect(rendered).toContain('Monthly Token Usage Report (Timezone: UTC)');
    expect(rendered).toContain('│ Period');
    expect(rendered.startsWith('\n')).toBe(false);
    expect(rendered.includes(`${String.fromCharCode(27)}[`)).toBe(false);

    const envSectionIndex = rendered.indexOf('Active environment overrides:');
    const headerIndex = rendered.indexOf('Monthly Token Usage Report (Timezone: UTC)');
    const tableIndex = rendered.indexOf('╭');

    expect(headerIndex).toBeGreaterThan(envSectionIndex);
    expect(tableIndex).toBeGreaterThan(headerIndex);
  });

  it('renders markdown output with multiline model cells using <br>', () => {
    const rendered = renderUsageReport(sampleUsageData, 'markdown', { granularity: 'daily' });

    expect(rendered).toContain('| Period');
    expect(rendered).toContain('• gpt-4.1<br>• gpt-5-codex');
  });

  it('renders JSON output as pretty-printed row payload only', () => {
    const rendered = renderUsageReport(sampleUsageData, 'json', { granularity: 'weekly' });

    const parsed = JSON.parse(rendered) as Array<{ rowType: string; periodKey: string }>;

    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ rowType: 'period_source', periodKey: '2026-02-10' });
    expect(parsed[2]).toMatchObject({ rowType: 'grand_total', periodKey: 'ALL' });
  });
});
