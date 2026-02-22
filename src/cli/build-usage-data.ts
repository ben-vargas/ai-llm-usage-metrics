import { aggregateUsage } from '../aggregate/aggregate-usage.js';
import { getActiveEnvVarOverrides } from '../config/env-var-display.js';
import {
  getParsingRuntimeConfig,
  getPricingFetcherRuntimeConfig,
} from '../config/runtime-overrides.js';
import { createDefaultAdapters } from '../sources/create-default-adapters.js';
import type { ReportGranularity } from '../utils/time-buckets.js';
import { assembleUsageDataResult, buildUsageDiagnostics } from './build-usage-data-diagnostics.js';
import { normalizeBuildUsageInputs, selectAdaptersForParsing } from './build-usage-data-inputs.js';
import {
  filterParsedAdapterEvents,
  parseSelectedAdapters,
  throwOnExplicitSourceFailures,
} from './build-usage-data-parsing.js';
import {
  resolveAndApplyPricingToEvents,
  resolvePricingSource,
} from './build-usage-data-pricing.js';
import type {
  BuildUsageDataDeps,
  ReportCommandOptions,
  UsageDataResult,
} from './usage-data-contracts.js';

export async function buildUsageData(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
  deps: BuildUsageDataDeps = {},
): Promise<UsageDataResult> {
  const normalizedInputs = normalizeBuildUsageInputs(options);

  const readParsingRuntimeConfig = deps.getParsingRuntimeConfig ?? getParsingRuntimeConfig;
  const readPricingRuntimeConfig =
    deps.getPricingFetcherRuntimeConfig ?? getPricingFetcherRuntimeConfig;
  const makeAdapters = deps.createAdapters ?? createDefaultAdapters;
  const loadPricingSource = deps.resolvePricingSource ?? resolvePricingSource;
  const readEnvVarOverrides = deps.getActiveEnvVarOverrides ?? getActiveEnvVarOverrides;

  const parsingRuntimeConfig = readParsingRuntimeConfig();
  const pricingRuntimeConfig = readPricingRuntimeConfig();
  const adapters = makeAdapters(options);
  const adaptersToParse = selectAdaptersForParsing(adapters, normalizedInputs.sourceFilter);

  const { successfulParseResults, sourceFailures } = await parseSelectedAdapters(
    adaptersToParse,
    parsingRuntimeConfig.maxParallelFileParsing,
  );

  throwOnExplicitSourceFailures(sourceFailures, normalizedInputs.explicitSourceIds);

  const filteredEvents = filterParsedAdapterEvents(successfulParseResults, {
    timezone: normalizedInputs.timezone,
    since: options.since,
    until: options.until,
    providerFilter: normalizedInputs.providerFilter,
    modelFilter: normalizedInputs.modelFilter,
  });

  const { pricedEvents, pricingOrigin } = await resolveAndApplyPricingToEvents(
    filteredEvents,
    options,
    pricingRuntimeConfig,
    loadPricingSource,
  );

  const rows = aggregateUsage(pricedEvents, {
    granularity,
    timezone: normalizedInputs.timezone,
    sourceOrder: adaptersToParse.map((adapter) => adapter.id),
  });

  const diagnostics = buildUsageDiagnostics({
    adaptersToParse,
    successfulParseResults,
    sourceFailures,
    pricingOrigin,
    activeEnvOverrides: readEnvVarOverrides(),
    timezone: normalizedInputs.timezone,
  });

  return assembleUsageDataResult(rows, diagnostics);
}
