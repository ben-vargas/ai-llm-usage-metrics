import { readFileSync } from 'node:fs';

const inputPath = 'coverage/coverage-summary.json';

const minimumCoveragePercent = {
  lines: 90,
  statements: 90,
  functions: 95,
  branches: 85,
};

const coverageSummary = JSON.parse(readFileSync(inputPath, 'utf8'));
const totals = coverageSummary.total;

if (!totals) {
  throw new Error(`Could not find total coverage metrics in ${inputPath}`);
}

const failedMetrics = Object.entries(minimumCoveragePercent).flatMap(([metric, minimum]) => {
  const actual = totals[metric]?.pct;

  if (typeof actual !== 'number') {
    throw new Error(`Could not find coverage metric "${metric}" in ${inputPath}`);
  }

  if (actual >= minimum) {
    return [];
  }

  return [`${metric}: ${actual.toFixed(2)}% < ${minimum.toFixed(2)}%`];
});

if (failedMetrics.length > 0) {
  throw new Error(
    `Coverage threshold check failed:\n${failedMetrics.map((item) => `- ${item}`).join('\n')}`,
  );
}
