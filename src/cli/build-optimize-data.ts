import { aggregateUsage } from '../aggregate/aggregate-usage.js';
import { compareByCodePoint } from '../utils/compare-by-code-point.js';
import type { ReportGranularity } from '../utils/time-buckets.js';
import { buildUsageDiagnostics } from './build-usage-data-diagnostics.js';
import {
  applyPricingToUsageEventDataset,
  buildUsageEventDataset,
} from './build-usage-event-dataset.js';
import type {
  BuildUsageDataDeps,
  OptimizeCommandOptions,
  OptimizeDataResult,
} from './usage-data-contracts.js';
import {
  buildCounterfactualRows,
  normalizeCandidateModels,
  parseTopOption,
} from '../optimize/aggregate-counterfactual.js';

export type BuildOptimizeDataDeps = BuildUsageDataDeps;

function normalizeProviderValue(provider: string | undefined): string | undefined {
  if (!provider) {
    return undefined;
  }

  const normalized = provider.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveOptimizeProvider(
  providers: Set<string>,
  providerFilter: string | undefined,
): string {
  const distinctProviders = [...providers].sort(compareByCodePoint);
  const normalizedProviderFilter = normalizeProviderValue(providerFilter);

  if (distinctProviders.length > 1) {
    if (
      normalizedProviderFilter &&
      distinctProviders.every((provider) => provider.includes(normalizedProviderFilter))
    ) {
      return normalizedProviderFilter;
    }

    throw new Error(
      `Optimize requires a single provider; found providers: ${distinctProviders.join(', ')}. Narrow with --provider.`,
    );
  }

  if (distinctProviders.length === 1) {
    return distinctProviders[0];
  }

  return normalizedProviderFilter ?? 'unknown';
}

export async function buildOptimizeData(
  granularity: ReportGranularity,
  options: OptimizeCommandOptions,
  deps: BuildOptimizeDataDeps = {},
): Promise<OptimizeDataResult> {
  const candidateModels = normalizeCandidateModels(options.candidateModel);
  const top = parseTopOption(options.top);

  const dataset = await buildUsageEventDataset(options, deps);
  const detectedProviders = new Set(
    dataset.filteredEvents
      .map((event) => normalizeProviderValue(event.provider))
      .filter((provider): provider is string => provider !== undefined),
  );
  const provider = resolveOptimizeProvider(
    detectedProviders,
    dataset.normalizedInputs.providerFilter,
  );

  const { pricedEvents, pricingOrigin, pricingWarning, pricingSource } =
    await applyPricingToUsageEventDataset(dataset, deps, 'force');

  const usageRows = aggregateUsage(pricedEvents, {
    granularity,
    timezone: dataset.normalizedInputs.timezone,
    sourceOrder: dataset.adaptersToParse.map((adapter) => adapter.id),
  });

  const counterfactual = buildCounterfactualRows({
    usageRows,
    provider,
    candidateModels,
    pricingSource,
    top,
  });

  const usageDiagnostics = buildUsageDiagnostics({
    adaptersToParse: dataset.adaptersToParse,
    successfulParseResults: dataset.successfulParseResults,
    sourceFailures: dataset.sourceFailures,
    pricingOrigin,
    pricingWarning,
    activeEnvOverrides: dataset.readEnvVarOverrides(),
    timezone: dataset.normalizedInputs.timezone,
  });

  return {
    rows: counterfactual.rows,
    diagnostics: {
      usage: usageDiagnostics,
      provider,
      baselineCostIncomplete: counterfactual.baselineCostIncomplete,
      candidatesWithMissingPricing: counterfactual.candidatesWithMissingPricing,
      warning: counterfactual.warning,
    },
  };
}
