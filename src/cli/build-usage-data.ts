import { aggregateUsage } from '../aggregate/aggregate-usage.js';
import { getActiveEnvVarOverrides } from '../config/env-var-display.js';
import {
  getParsingRuntimeConfig,
  getPricingFetcherRuntimeConfig,
  type PricingFetcherRuntimeConfig,
} from '../config/runtime-overrides.js';
import type { UsageEvent } from '../domain/usage-event.js';
import { applyPricingToEvents } from '../pricing/cost-engine.js';
import { LiteLLMPricingFetcher } from '../pricing/litellm-pricing-fetcher.js';

import type { PricingSource } from '../pricing/types.js';
import { createDefaultAdapters } from '../sources/create-default-adapters.js';
import type { SourceAdapter } from '../sources/source-adapter.js';
import { getPeriodKey, type ReportGranularity } from '../utils/time-buckets.js';
import type {
  BuildUsageDataDeps,
  PricingLoadResult,
  ReportCommandOptions,
  UsageDataResult,
  UsageDiagnostics,
  UsagePricingOrigin,
  UsageSessionStats,
} from './usage-data-contracts.js';

function validateDateInput(value: string, flagName: '--since' | '--until'): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${flagName} must use format YYYY-MM-DD`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${flagName} has an invalid calendar date`);
  }
}

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

function normalizeProviderFilter(provider: string | undefined): string | undefined {
  if (!provider) {
    return undefined;
  }

  const normalized = provider.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeSourceFilter(source: string | string[] | undefined): Set<string> | undefined {
  if (!source || (Array.isArray(source) && source.length === 0)) {
    return undefined;
  }

  const sourceCandidates = Array.isArray(source) ? source : [source];
  const normalizedSources = sourceCandidates
    .flatMap((candidate) => candidate.split(','))
    .map((candidate) => candidate.trim().toLowerCase())
    .filter((candidate) => candidate.length > 0);

  if (normalizedSources.length === 0) {
    throw new Error('--source must contain at least one non-empty source id');
  }

  return new Set(normalizedSources);
}

function normalizeModelFilter(model: string | string[] | undefined): string[] | undefined {
  if (!model || (Array.isArray(model) && model.length === 0)) {
    return undefined;
  }

  const modelCandidates = Array.isArray(model) ? model : [model];
  const normalizedModels = modelCandidates
    .flatMap((candidate) => candidate.split(','))
    .map((candidate) => candidate.trim().toLowerCase())
    .filter((candidate) => candidate.length > 0);

  if (normalizedModels.length === 0) {
    throw new Error('--model must contain at least one non-empty model filter');
  }

  return [...new Set(normalizedModels)];
}

function validateSourceFilterValues(
  sourceFilter: Set<string> | undefined,
  availableSourceIds: ReadonlySet<string>,
): void {
  if (!sourceFilter) {
    return;
  }

  const unknownSources = [...sourceFilter].filter((source) => !availableSourceIds.has(source));

  if (unknownSources.length === 0) {
    return;
  }

  const allowedSources = [...availableSourceIds].sort((left, right) => left.localeCompare(right));

  throw new Error(
    `Unknown --source value(s): ${unknownSources.join(', ')}. Allowed values: ${allowedSources.join(', ')}`,
  );
}

function matchesProvider(
  provider: string | undefined,
  providerFilter: string | undefined,
): boolean {
  if (!providerFilter) {
    return true;
  }

  return provider?.toLowerCase().includes(providerFilter) ?? false;
}

type ModelFilterRule = {
  value: string;
  mode: 'exact' | 'substring';
};

function resolveModelFilterRules(
  events: UsageEvent[],
  modelFilter: string[] | undefined,
): ModelFilterRule[] | undefined {
  if (!modelFilter || modelFilter.length === 0) {
    return undefined;
  }

  const availableModels = new Set(
    events
      .map((event) => event.model?.toLowerCase())
      .filter((model): model is string => Boolean(model)),
  );

  return modelFilter.map((value) => ({
    value,
    mode: availableModels.has(value) ? 'exact' : 'substring',
  }));
}

function matchesModel(
  model: string | undefined,
  modelRules: ModelFilterRule[] | undefined,
): boolean {
  if (!modelRules || modelRules.length === 0) {
    return true;
  }

  if (!model) {
    return false;
  }

  const normalizedModel = model.toLowerCase();

  return modelRules.some((rule) =>
    rule.mode === 'exact' ? normalizedModel === rule.value : normalizedModel.includes(rule.value),
  );
}

type AdapterParseResult = {
  events: UsageEvent[];
  filesFound: number;
};

async function parseAdapterEvents(
  adapter: SourceAdapter,
  maxParallelFileParsing: number,
): Promise<AdapterParseResult> {
  const files = await adapter.discoverFiles();

  if (files.length === 0) {
    return { events: [], filesFound: 0 };
  }

  const safeMaxParallelFileParsing =
    Number.isFinite(maxParallelFileParsing) && maxParallelFileParsing > 0
      ? Math.max(1, Math.floor(maxParallelFileParsing))
      : 1;
  const parsedByFile: UsageEvent[][] = Array.from({ length: files.length }, () => []);
  const workerCount = Math.min(safeMaxParallelFileParsing, files.length);
  let nextFileIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextFileIndex < files.length) {
      const fileIndex = nextFileIndex;
      nextFileIndex += 1;

      parsedByFile[fileIndex] = await adapter.parseFile(files[fileIndex]);
    }
  });

  await Promise.all(workers);

  return {
    events: parsedByFile.flat(),
    filesFound: files.length,
  };
}

function filterEventsByDateRange(
  events: UsageEvent[],
  timezone: string,
  since: string | undefined,
  until: string | undefined,
): UsageEvent[] {
  return events.filter((event) => {
    const eventDate = getPeriodKey(event.timestamp, 'daily', timezone);

    if (since && eventDate < since) {
      return false;
    }

    if (until && eventDate > until) {
      return false;
    }

    return true;
  });
}

function validatePricingUrl(pricingUrl: string | undefined): void {
  if (!pricingUrl) {
    return;
  }

  try {
    const parsedUrl = new URL(pricingUrl);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch {
    throw new Error('--pricing-url must be a valid http(s) URL');
  }
}

async function resolvePricingSource(
  options: ReportCommandOptions,
  runtimeConfig: PricingFetcherRuntimeConfig,
): Promise<PricingLoadResult> {
  const litellmPricingFetcher = new LiteLLMPricingFetcher({
    sourceUrl: options.pricingUrl,
    offline: options.pricingOffline,
    cacheTtlMs: runtimeConfig.cacheTtlMs,
    fetchTimeoutMs: runtimeConfig.fetchTimeoutMs,
  });

  try {
    const fromCache = await litellmPricingFetcher.load();

    if (options.pricingOffline) {
      return { source: litellmPricingFetcher, origin: 'offline-cache' };
    }

    return { source: litellmPricingFetcher, origin: fromCache ? 'cache' : 'network' };
  } catch (error) {
    if (options.pricingOffline) {
      throw new Error('Offline pricing mode enabled but cached pricing is unavailable');
    }

    const reason = error instanceof Error ? error.message : String(error);

    if (options.pricingUrl) {
      throw new Error(`Could not load pricing from --pricing-url: ${reason}`);
    }

    throw new Error(`Could not load LiteLLM pricing: ${reason}`);
  }
}

function eventNeedsPricingLookup(event: UsageEvent): boolean {
  if (!event.model) {
    return false;
  }

  return event.costMode !== 'explicit' || event.costUsd === undefined || event.costUsd === 0;
}

function shouldLoadPricingSource(options: ReportCommandOptions, events: UsageEvent[]): boolean {
  if (options.pricingUrl || options.pricingOffline) {
    return true;
  }

  return events.some((event) => eventNeedsPricingLookup(event));
}

function validateBuildOptions(options: ReportCommandOptions): void {
  if (options.since) {
    validateDateInput(options.since, '--since');
  }

  if (options.until) {
    validateDateInput(options.until, '--until');
  }

  if (options.since && options.until && options.since > options.until) {
    throw new Error('--since must be less than or equal to --until');
  }

  validatePricingUrl(options.pricingUrl);
}

export async function buildUsageData(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
  deps: BuildUsageDataDeps = {},
): Promise<UsageDataResult> {
  validateBuildOptions(options);

  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  validateTimezone(timezone);

  const providerFilter = normalizeProviderFilter(options.provider);
  const sourceFilter = normalizeSourceFilter(options.source);
  const modelFilter = normalizeModelFilter(options.model);

  const readParsingRuntimeConfig = deps.getParsingRuntimeConfig ?? getParsingRuntimeConfig;
  const readPricingRuntimeConfig =
    deps.getPricingFetcherRuntimeConfig ?? getPricingFetcherRuntimeConfig;
  const makeAdapters = deps.createAdapters ?? createDefaultAdapters;
  const loadPricingSource = deps.resolvePricingSource ?? resolvePricingSource;
  const readEnvVarOverrides = deps.getActiveEnvVarOverrides ?? getActiveEnvVarOverrides;

  const parsingRuntimeConfig = readParsingRuntimeConfig();
  const pricingRuntimeConfig = readPricingRuntimeConfig();
  const adapters = makeAdapters(options);

  const availableSourceIds = new Set(adapters.map((adapter) => adapter.id.toLowerCase()));
  validateSourceFilterValues(sourceFilter, availableSourceIds);

  const adaptersToParse = sourceFilter
    ? adapters.filter((adapter) => sourceFilter.has(adapter.id.toLowerCase()))
    : adapters;

  const parseResults = await Promise.all(
    adaptersToParse.map((adapter) =>
      parseAdapterEvents(adapter, parsingRuntimeConfig.maxParallelFileParsing),
    ),
  );

  const sessionStats: UsageSessionStats[] = parseResults.map((result, index) => ({
    source: adaptersToParse[index].id,
    filesFound: result.filesFound,
    eventsParsed: result.events.length,
  }));

  const providerFilteredEvents = parseResults
    .flatMap((result) => result.events)
    .filter((event) => matchesProvider(event.provider, providerFilter));

  const providerAndDateFilteredEvents = filterEventsByDateRange(
    providerFilteredEvents,
    timezone,
    options.since,
    options.until,
  );

  const modelFilterRules = resolveModelFilterRules(providerAndDateFilteredEvents, modelFilter);
  const dateFilteredEvents = providerAndDateFilteredEvents.filter((event) =>
    matchesModel(event.model, modelFilterRules),
  );

  let pricingOrigin: UsagePricingOrigin = 'none';
  let pricingSource: PricingSource | undefined;

  if (shouldLoadPricingSource(options, dateFilteredEvents)) {
    const pricingResult = await loadPricingSource(options, pricingRuntimeConfig);
    pricingSource = pricingResult.source;
    pricingOrigin = pricingResult.origin;
  }

  const pricedEvents = pricingSource
    ? applyPricingToEvents(dateFilteredEvents, pricingSource)
    : dateFilteredEvents;

  const rows = aggregateUsage(pricedEvents, {
    granularity,
    timezone,
    sourceOrder: adaptersToParse.map((adapter) => adapter.id),
  });

  const diagnostics: UsageDiagnostics = {
    sessionStats,
    pricingOrigin,
    activeEnvOverrides: readEnvVarOverrides(),
    timezone,
  };

  return {
    rows,
    diagnostics,
  };
}
