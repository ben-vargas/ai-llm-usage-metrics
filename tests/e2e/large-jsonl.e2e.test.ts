import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { buildUsageReport } from '../../src/cli/run-usage-report.js';

type JsonReportRow = {
  rowType: string;
  periodKey: string;
  source: string;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd: number;
};

const piDir = path.resolve('tests/fixtures/e2e-large/pi');
const codexDir = path.resolve('tests/fixtures/e2e-large/codex');

describe('large jsonl fixture e2e', () => {
  it('aggregates a large fixture without pricing fetches', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('fetch should not be called for explicit-cost fixture');
    });

    vi.stubGlobal('fetch', fetchSpy);

    try {
      const report = await buildUsageReport('daily', {
        piDir,
        codexDir,
        timezone: 'UTC',
        json: true,
      });

      const rows = JSON.parse(report) as JsonReportRow[];
      const periodRow = rows.find((row) => row.rowType === 'period_source' && row.source === 'pi');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(periodRow).toMatchObject({
        rowType: 'period_source',
        periodKey: '2026-03-01',
        source: 'pi',
        models: ['gpt-4.1'],
        inputTokens: 20_000,
        outputTokens: 30_000,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 50_000,
      });
      expect(periodRow?.costUsd ?? 0).toBeCloseTo(10, 10);
      expect(rows.at(-1)).toMatchObject({
        rowType: 'grand_total',
        periodKey: 'ALL',
        totalTokens: 50_000,
        costUsd: 10,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
