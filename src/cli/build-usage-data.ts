import { getActiveEnvVarOverrides } from '../config/env-var-display.js';
import type { ReportGranularity } from '../utils/time-buckets.js';
import type { ReportCommandOptions } from './run-usage-report.js';
import type { BuildUsageDataDeps, UsageDataResult } from './usage-data-contracts.js';

export async function buildUsageData(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
  deps: BuildUsageDataDeps = {},
): Promise<UsageDataResult> {
  void granularity;

  const readEnvVarOverrides = deps.getActiveEnvVarOverrides ?? getActiveEnvVarOverrides;
  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    rows: [],
    diagnostics: {
      sessionStats: [],
      pricingOrigin: 'none',
      activeEnvOverrides: readEnvVarOverrides(),
      timezone,
    },
  };
}
