import type { EnvVarOverride } from '../config/env-var-display.js';
import type {
  ParsingRuntimeConfig,
  PricingFetcherRuntimeConfig,
} from '../config/runtime-overrides.js';
import type { UsageReportRow } from '../domain/usage-report-row.js';
import type { PricingSource } from '../pricing/types.js';
import type { SourceAdapter } from '../sources/source-adapter.js';

export type ReportCommandOptions = {
  piDir?: string;
  codexDir?: string;
  source?: string | string[];
  since?: string;
  until?: string;
  timezone?: string;
  provider?: string;
  markdown?: boolean;
  json?: boolean;
  pricingUrl?: string;
  pricingOffline?: boolean;
};

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
  getParsingRuntimeConfig?: () => ParsingRuntimeConfig;
  getPricingFetcherRuntimeConfig?: () => PricingFetcherRuntimeConfig;
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
