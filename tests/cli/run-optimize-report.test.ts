import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/cli/build-optimize-data.js', () => ({
  buildOptimizeData: vi.fn(async () => ({
    rows: [
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
        baselineCostUsd: 2,
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
        candidateModel: 'gpt-5-codex',
        candidateResolvedModel: 'gpt-5-codex',
        hypotheticalCostUsd: 1.5,
        hypotheticalCostIncomplete: false,
        savingsUsd: 0.5,
        savingsPct: 0.25,
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
        candidateModel: 'missing-model',
        candidateResolvedModel: 'missing-model',
        hypotheticalCostUsd: undefined,
        hypotheticalCostIncomplete: true,
        savingsUsd: undefined,
        savingsPct: undefined,
        notes: ['missing_pricing'],
      },
    ],
    diagnostics: {
      usage: {
        sessionStats: [],
        sourceFailures: [],
        skippedRows: [],
        pricingOrigin: 'none',
        activeEnvOverrides: [],
        timezone: 'UTC',
      },
      provider: 'openai',
      baselineCostIncomplete: false,
      candidatesWithMissingPricing: ['missing-model'],
    },
  })),
}));

import { buildOptimizeReport, runOptimizeReport } from '../../src/cli/run-optimize-report.js';

describe('run-optimize-report', () => {
  it('rejects mutually exclusive output flags', async () => {
    await expect(
      buildOptimizeReport('daily', {
        markdown: true,
        json: true,
        candidateModel: ['gpt-4.1'],
      }),
    ).rejects.toThrow('Choose either --markdown or --json, not both');
  });

  it('renders terminal output with optimize title', async () => {
    const report = await buildOptimizeReport('monthly', {
      candidateModel: ['gpt-4.1'],
    });

    expect(report).toContain('Monthly Optimize Report');
    expect(report).toContain('│ Period');
    expect(report).toContain('│ Candidate');
  });

  it('renders deterministic JSON row ordering', async () => {
    const report = await buildOptimizeReport('daily', {
      candidateModel: ['gpt-4.1'],
      json: true,
    });

    const parsed = JSON.parse(report) as Array<{ rowType: string; candidateModel?: string }>;

    expect(parsed.map((row) => row.rowType)).toEqual(['baseline', 'candidate', 'candidate']);
    expect(parsed[1]?.candidateModel).toBe('gpt-5-codex');
    expect(parsed[2]?.candidateModel).toBe('missing-model');
  });

  it('keeps diagnostics on stderr for JSON output', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await runOptimizeReport('daily', {
      candidateModel: ['gpt-4.1'],
      json: true,
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const stdoutBody = String(consoleLogSpy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(stdoutBody) as unknown;
    expect(Array.isArray(parsed)).toBe(true);

    const stderrLines = consoleErrorSpy.mock.calls.map((call) => String(call[0]));
    expect(stderrLines.some((line) => line.includes('No sessions found'))).toBe(true);
    expect(stderrLines.some((line) => line.includes('Optimize provider scope'))).toBe(true);
    expect(
      stderrLines.some((line) => line.includes('Missing pricing for candidate model(s)')),
    ).toBe(true);
  });
});
