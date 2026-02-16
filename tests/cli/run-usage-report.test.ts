import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildUsageReport } from '../../src/cli/run-usage-report.js';

describe('buildUsageReport', () => {
  it('builds markdown report with source-separated and combined rows', async () => {
    const report = await buildUsageReport('daily', {
      piDir: path.resolve('tests/fixtures/pi'),
      codexDir: path.resolve('tests/fixtures/codex'),
      timezone: 'UTC',
      markdown: true,
    });

    expect(report).toContain('| Period');
    expect(report).toContain('| Source');
    expect(report).toContain('| Models');
    expect(report).toMatch(/\|\s+\d{4}-\d{2}-\d{2}\s+\|\s+pi\s+\|/u);
    expect(report).toMatch(/\|\s+\d{4}-\d{2}-\d{2}\s+\|\s+codex\s+\|/u);
    expect(report).toMatch(/\|\s+\d{4}-\d{2}-\d{2}\s+\|\s+combined\s+\|/u);
    expect(report).toMatch(/\|\s+ALL\s+\|\s+TOTAL\s+\|/u);
  });

  it('builds json report when --json semantics are requested', async () => {
    const report = await buildUsageReport('weekly', {
      piDir: path.resolve('tests/fixtures/pi'),
      codexDir: path.resolve('tests/fixtures/codex'),
      timezone: 'UTC',
      json: true,
    });

    const parsed = JSON.parse(report) as { rowType: string; periodKey: string }[];

    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.at(-1)).toMatchObject({ rowType: 'grand_total', periodKey: 'ALL' });
  });

  it('validates date flags and range ordering', async () => {
    await expect(
      buildUsageReport('daily', {
        since: '2026-2-10',
      }),
    ).rejects.toThrow('--since must use format YYYY-MM-DD');

    await expect(
      buildUsageReport('daily', {
        since: '2026-02-20',
        until: '2026-02-10',
      }),
    ).rejects.toThrow('--since must be less than or equal to --until');
  });

  it('validates conflicting output flags', async () => {
    await expect(
      buildUsageReport('daily', {
        markdown: true,
        json: true,
      }),
    ).rejects.toThrow('Choose either --markdown or --json, not both');
  });
});
