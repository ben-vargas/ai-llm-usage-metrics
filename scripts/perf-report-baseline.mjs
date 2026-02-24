import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { buildEfficiencyReport } from '../src/cli/run-efficiency-report.ts';
import { buildUsageReport } from '../src/cli/run-usage-report.ts';

const piDir = path.resolve('tests/fixtures/e2e/pi');
const codexDir = path.resolve('tests/fixtures/e2e/codex');

const scenarios = [
  {
    name: 'daily-terminal',
    kind: 'usage',
    granularity: 'daily',
    options: { piDir, codexDir, timezone: 'UTC' },
  },
  {
    name: 'daily-markdown',
    kind: 'usage',
    granularity: 'daily',
    options: { piDir, codexDir, timezone: 'UTC', markdown: true },
  },
  {
    name: 'daily-json',
    kind: 'usage',
    granularity: 'daily',
    options: { piDir, codexDir, timezone: 'UTC', json: true },
  },
  {
    name: 'weekly-json',
    kind: 'usage',
    granularity: 'weekly',
    options: { piDir, codexDir, timezone: 'UTC', json: true },
  },
  {
    name: 'monthly-json',
    kind: 'usage',
    granularity: 'monthly',
    options: { piDir, codexDir, timezone: 'UTC', json: true },
  },
  {
    name: 'efficiency-daily-json',
    kind: 'efficiency',
    granularity: 'daily',
    options: {
      piDir,
      codexDir,
      timezone: 'UTC',
      source: 'pi,codex',
      since: '2026-02-14',
      until: '2026-02-14',
      json: true,
    },
  },
];

function summarizeDurations(durationsMs) {
  const sorted = [...durationsMs].sort((left, right) => left - right);
  const minMs = sorted[0];
  const maxMs = sorted.at(-1);
  const averageMs = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  const p95Ms = sorted[p95Index];

  return {
    minMs,
    averageMs,
    p95Ms,
    maxMs,
  };
}

function runGit(repoDir, args, env = {}) {
  execFileSync('git', ['-C', repoDir, ...args], {
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'pipe',
  });
}

async function createEfficiencyFixtureRepo() {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'usage-metrics-efficiency-perf-'));

  runGit(repoDir, ['init']);
  runGit(repoDir, ['config', 'user.name', 'Perf Runner']);
  runGit(repoDir, ['config', 'user.email', 'perf@example.com']);

  const trackedFilePath = path.join(repoDir, 'tracked.txt');
  await writeFile(trackedFilePath, 'line-1\nline-2\n', 'utf8');
  runGit(repoDir, ['add', 'tracked.txt']);
  runGit(repoDir, ['commit', '-m', 'seed'], {
    GIT_AUTHOR_DATE: '2026-02-14T10:00:00Z',
    GIT_COMMITTER_DATE: '2026-02-14T10:00:00Z',
  });

  return repoDir;
}

async function measureScenario(scenario, options) {
  const durationsMs = [];

  for (let index = 0; index < options.warmupRuns + options.sampleRuns; index += 1) {
    const startedAt = performance.now();
    const output =
      scenario.kind === 'efficiency'
        ? await buildEfficiencyReport(scenario.granularity, scenario.options)
        : await buildUsageReport(scenario.granularity, scenario.options);
    const elapsedMs = performance.now() - startedAt;

    if (!output || output.length === 0) {
      throw new Error(`Scenario ${scenario.name} produced empty output`);
    }

    if (index >= options.warmupRuns) {
      durationsMs.push(elapsedMs);
    }
  }

  return summarizeDurations(durationsMs);
}

async function main() {
  const warmupRuns = 1;
  const sampleRuns = 5;
  const efficiencyRepoDir = await createEfficiencyFixtureRepo();

  console.log('Usage report performance baseline');
  console.log(`fixtures: pi=${piDir}, codex=${codexDir}`);
  console.log(`efficiency repo: ${efficiencyRepoDir}`);
  console.log(`warmup runs: ${warmupRuns}, sample runs: ${sampleRuns}`);
  console.log('');

  const rows = [];

  try {
    for (const scenario of scenarios) {
      const options =
        scenario.kind === 'efficiency'
          ? { ...scenario.options, repoDir: efficiencyRepoDir }
          : scenario.options;
      const stats = await measureScenario({ ...scenario, options }, { warmupRuns, sampleRuns });

      rows.push({
        scenario: scenario.name,
        min: `${stats.minMs.toFixed(1)}ms`,
        avg: `${stats.averageMs.toFixed(1)}ms`,
        p95: `${stats.p95Ms.toFixed(1)}ms`,
        max: `${stats.maxMs.toFixed(1)}ms`,
      });
    }
  } finally {
    await rm(efficiencyRepoDir, { recursive: true, force: true });
  }

  console.table(rows);
}

await main();
