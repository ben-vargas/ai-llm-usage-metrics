import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { buildUsageReport } from '../src/cli/run-usage-report.ts';

const piDir = path.resolve('tests/fixtures/e2e/pi');
const codexDir = path.resolve('tests/fixtures/e2e/codex');

const scenarios = [
  {
    name: 'daily-terminal',
    granularity: 'daily',
    options: { piDir, codexDir, timezone: 'UTC' },
  },
  {
    name: 'daily-markdown',
    granularity: 'daily',
    options: { piDir, codexDir, timezone: 'UTC', markdown: true },
  },
  {
    name: 'daily-json',
    granularity: 'daily',
    options: { piDir, codexDir, timezone: 'UTC', json: true },
  },
  {
    name: 'weekly-json',
    granularity: 'weekly',
    options: { piDir, codexDir, timezone: 'UTC', json: true },
  },
  {
    name: 'monthly-json',
    granularity: 'monthly',
    options: { piDir, codexDir, timezone: 'UTC', json: true },
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

async function measureScenario(scenario, options) {
  const durationsMs = [];

  for (let index = 0; index < options.warmupRuns + options.sampleRuns; index += 1) {
    const startedAt = performance.now();
    const output = await buildUsageReport(scenario.granularity, scenario.options);
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

  console.log('Usage report performance baseline');
  console.log(`fixtures: pi=${piDir}, codex=${codexDir}`);
  console.log(`warmup runs: ${warmupRuns}, sample runs: ${sampleRuns}`);
  console.log('');

  const rows = [];

  for (const scenario of scenarios) {
    const stats = await measureScenario(scenario, { warmupRuns, sampleRuns });

    rows.push({
      scenario: scenario.name,
      min: `${stats.minMs.toFixed(1)}ms`,
      avg: `${stats.averageMs.toFixed(1)}ms`,
      p95: `${stats.p95Ms.toFixed(1)}ms`,
      max: `${stats.maxMs.toFixed(1)}ms`,
    });
  }

  console.table(rows);
}

await main();
