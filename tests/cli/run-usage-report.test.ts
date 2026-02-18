import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildUsageReport } from '../../src/cli/run-usage-report.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('buildUsageReport', () => {
  it('builds markdown report with source-separated rows', async () => {
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
    expect(report).not.toMatch(/\|\s+\d{4}-\d{2}-\d{2}\s+\|\s+combined\s+\|/u);
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
    expect(parsed.some((row) => row.rowType === 'period_combined')).toBe(true);
    expect(parsed.at(-1)).toMatchObject({ rowType: 'grand_total', periodKey: 'ALL' });
  });

  it('filters rows to a single source when --source is provided', async () => {
    const report = await buildUsageReport('daily', {
      piDir: path.resolve('tests/fixtures/pi'),
      codexDir: path.resolve('tests/fixtures/codex'),
      timezone: 'UTC',
      source: 'codex',
      json: true,
    });

    const parsed = JSON.parse(report) as { rowType: string; source: string }[];

    expect(parsed.some((row) => row.rowType === 'period_source' && row.source === 'codex')).toBe(
      true,
    );
    expect(parsed.some((row) => row.rowType === 'period_source' && row.source === 'pi')).toBe(
      false,
    );
    expect(parsed.some((row) => row.rowType === 'period_combined')).toBe(false);
  });

  it('supports comma-separated source filters', async () => {
    const report = await buildUsageReport('daily', {
      piDir: path.resolve('tests/fixtures/pi'),
      codexDir: path.resolve('tests/fixtures/codex'),
      timezone: 'UTC',
      source: 'pi,codex',
      json: true,
    });

    const parsed = JSON.parse(report) as { rowType: string; source: string }[];

    expect(parsed.some((row) => row.rowType === 'period_source' && row.source === 'pi')).toBe(true);
    expect(parsed.some((row) => row.rowType === 'period_source' && row.source === 'codex')).toBe(
      true,
    );
  });

  it('defaults provider filtering to openai for both pi and codex sources', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'usage-provider-filter-'));
    tempDirs.push(tempDir);

    const codexSessionPath = path.join(tempDir, 'session.jsonl');

    await writeFile(
      codexSessionPath,
      [
        JSON.stringify({
          timestamp: '2026-02-14T10:00:00.000Z',
          type: 'session_meta',
          payload: { id: 'codex-provider-test', model_provider: 'anthropic' },
        }),
        JSON.stringify({
          timestamp: '2026-02-14T10:00:01.000Z',
          type: 'turn_context',
          payload: { model: 'claude-3.7-sonnet' },
        }),
        JSON.stringify({
          timestamp: '2026-02-14T10:00:02.000Z',
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              last_token_usage: {
                input_tokens: 10,
                cached_input_tokens: 0,
                output_tokens: 5,
                reasoning_output_tokens: 0,
                total_tokens: 15,
              },
            },
          },
        }),
      ].join('\n'),
      'utf8',
    );

    const report = await buildUsageReport('daily', {
      piDir: tempDir,
      codexDir: tempDir,
      timezone: 'UTC',
      json: true,
    });

    const parsed = JSON.parse(report) as {
      rowType: string;
      source: string;
      totalTokens: number;
      costUsd: number;
    }[];

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      rowType: 'grand_total',
      source: 'combined',
      totalTokens: 0,
      costUsd: 0,
    });
  });

  it('does not require pricing fetch when there are no events', async () => {
    const emptyDir = await mkdtemp(path.join(os.tmpdir(), 'usage-no-events-'));
    tempDirs.push(emptyDir);

    const fetchSpy = vi.fn(async () => {
      throw new Error('fetch should not be called when there are no events');
    });

    vi.stubGlobal('fetch', fetchSpy);

    try {
      const report = await buildUsageReport('daily', {
        piDir: emptyDir,
        codexDir: emptyDir,
        timezone: 'UTC',
        json: true,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(JSON.parse(report)).toEqual([
        {
          rowType: 'grand_total',
          periodKey: 'ALL',
          source: 'combined',
          models: [],
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 0,
          costUsd: 0,
        },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('validates date flags, range ordering and pricing URL', async () => {
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

    await expect(
      buildUsageReport('daily', {
        pricingUrl: 'not-a-url',
      }),
    ).rejects.toThrow('--pricing-url must be a valid http(s) URL');

    await expect(
      buildUsageReport('daily', {
        pricingUrl: 'http://127.0.0.1:1/pricing.json',
      }),
    ).rejects.toThrow('Could not load pricing from --pricing-url');
  });

  it('validates source filter input', async () => {
    await expect(
      buildUsageReport('daily', {
        source: '   ',
      }),
    ).rejects.toThrow('--source must contain at least one non-empty source id');

    await expect(
      buildUsageReport('daily', {
        source: 'claude',
      }),
    ).rejects.toThrow('Unknown --source value(s): claude. Allowed values: codex, pi');
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
