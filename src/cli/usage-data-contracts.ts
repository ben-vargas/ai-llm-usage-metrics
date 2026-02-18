import type { EnvVarOverride } from '../config/env-var-display.js';
import type { UsageReportRow } from '../domain/usage-report-row.js';
import type {
  getParsingRuntimeConfig,
  getPricingFetcherRuntimeConfig,
  PricingFetcherRuntimeConfig,
} from '../config/runtime-overrides.js';
import type { PricingSource } from '../pricing/types.js';
import type { SourceAdapter } from '../sources/source-adapter.js';
import type { ReportCommandOptions } from './run-usage-report.js';

export type UsageSessionStats = {
  source: string;
  filesFound: number;
  eventsParsed: number;
};

export type UsagePricingOrigin = 'cache' | 'network' | 'fallback' | 'offline-cache' | 'none';

export type UsageDiagnostics = {
  sessionStats: UsageSessionStats[];
  pricingOrigin: UsagePricingOrigin;
  activeEnvOverrides: EnvVarOverride[];
  timezone: string;
  warnings?: string[];
};

export type UsageDataResult = {
  rows: UsageReportRow[];
  diagnostics: UsageDiagnostics;
};

export type PricingLoadResult = {
  source: PricingSource;
  origin: Exclude<UsagePricingOrigin, 'none'>;
};

export type BuildUsageDataDeps = {
  getParsingRuntimeConfig?: typeof getParsingRuntimeConfig;
  getPricingFetcherRuntimeConfig?: typeof getPricingFetcherRuntimeConfig;
  createAdapters?: (
    options: ReportCommandOptions,
    effectiveProviderFilter: string,
  ) => SourceAdapter[];
  resolvePricingSource?: (
    options: ReportCommandOptions,
    runtimeConfig: PricingFetcherRuntimeConfig,
  ) => Promise<PricingLoadResult>;
  getActiveEnvVarOverrides?: () => EnvVarOverride[];
};
