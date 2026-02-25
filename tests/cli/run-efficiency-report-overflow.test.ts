import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/cli/build-efficiency-data.js', () => ({
  buildEfficiencyData: vi.fn(async () => ({
    rows: [],
    diagnostics: {
      usage: {
        sessionStats: [],
        sourceFailures: [],
        skippedRows: [],
        pricingOrigin: 'none',
        activeEnvOverrides: [],
        timezone: 'UTC',
      },
      repoDir: '/tmp/repo',
      includeMergeCommits: false,
      gitCommitCount: 0,
      gitLinesAdded: 0,
      gitLinesDeleted: 0,
      repoMatchedUsageEvents: 0,
      repoExcludedUsageEvents: 0,
      repoUnattributedUsageEvents: 0,
      scopeNote: undefined,
    },
  })),
}));

vi.mock('../../src/render/render-efficiency-report.js', () => ({
  renderEfficiencyReport: vi.fn(() => 'plain output without table-like characters'),
}));

import { runEfficiencyReport } from '../../src/cli/run-efficiency-report.js';

function overrideStdoutProperty<Key extends 'isTTY' | 'columns'>(
  property: Key,
  value: NodeJS.WriteStream[Key],
): () => void {
  const stdout = process.stdout as NodeJS.WriteStream;
  const previousDescriptor = Object.getOwnPropertyDescriptor(stdout, property);

  Object.defineProperty(stdout, property, {
    configurable: true,
    value,
  });

  return () => {
    if (previousDescriptor) {
      Object.defineProperty(stdout, property, previousDescriptor);
      return;
    }

    Reflect.deleteProperty(stdout, property);
  };
}

function overrideStdoutTty(columns: number): () => void {
  const restoreIsTTY = overrideStdoutProperty('isTTY', true);
  const restoreColumns = overrideStdoutProperty('columns', columns);

  return () => {
    restoreColumns();
    restoreIsTTY();
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runEfficiencyReport terminal overflow detection', () => {
  it('skips overflow warnings when output has no table lines', async () => {
    const restoreStdout = overrideStdoutTty(80);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await runEfficiencyReport('daily', {});
    } finally {
      restoreStdout();
    }

    expect(consoleLogSpy).toHaveBeenCalledWith('plain output without table-like characters');
    const stderrLines = consoleErrorSpy.mock.calls.map((call) => String(call[0]));
    expect(stderrLines.some((line) => line.includes('Report table is wider than terminal'))).toBe(
      false,
    );
  });
});
