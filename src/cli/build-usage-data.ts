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
import { createDefaultOpenAiPricingSource } from '../pricing/static-pricing-source.js';
import type { PricingSource } from '../pricing/types.js';
import { createDefaultAdapters } from '../sources/create-default-adapters.js';
import type { SourceAdapter } from '../sources/source-adapter.js';
import { getPeriodKey, type ReportGranularity } from '../utils/time-buckets.js';
import type { ReportCommandOptions } from './run-usage-report.js';
import type {
  BuildUsageDataDeps,
  PricingLoadResult,
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

  const parsedByFile: UsageEvent[][] = Array.from({ length: files.length }, () => []);
  const workerCount = Math.min(maxParallelFileParsing, files.length);
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
  const fallbackPricingSource = createDefaultOpenAiPricingSource();
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

    if (options.pricingUrl) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not load pricing from --pricing-url: ${reason}`);
    }

    return { source: fallbackPricingSource, origin: 'fallback' };
  }
}

function eventNeedsPricingLookup(event: UsageEvent): boolean {
  if (!event.model) {
    return false;
  }

  return event.costMode !== 'explicit' || event.costUsd === undefined;
}

function shouldLoadPricingSource(options: ReportCommandOptions, events: UsageEvent[]): boolean {
  if (options.pricingUrl || options.pricingOffline) {
    return true;
  }

  return events.some((event) => eventNeedsPricingLookup(event));
}

function validateBuildOptions(options: ReportCommandOptions): void {
  if (options.markdown && options.json) {
    throw new Error('Choose either --markdown or --json, not both');
  }

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
  const effectiveProviderFilter = providerFilter ?? 'openai';

  const readParsingRuntimeConfig = deps.getParsingRuntimeConfig ?? getParsingRuntimeConfig;
  const readPricingRuntimeConfig =
    deps.getPricingFetcherRuntimeConfig ?? getPricingFetcherRuntimeConfig;
  const makeAdapters = deps.createAdapters ?? createDefaultAdapters;
  const loadPricingSource = deps.resolvePricingSource ?? resolvePricingSource;
  const readEnvVarOverrides = deps.getActiveEnvVarOverrides ?? getActiveEnvVarOverrides;

  const parsingRuntimeConfig = readParsingRuntimeConfig();
  const pricingRuntimeConfig = readPricingRuntimeConfig();
  const adapters = makeAdapters(options, effectiveProviderFilter);

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

  const parsedEventsByAdapter = parseResults.map((result) => result.events);
  const providerFilteredEvents = parsedEventsByAdapter
    .flat()
    .filter((event) => matchesProvider(event.provider, effectiveProviderFilter));

  const dateFilteredEvents = filterEventsByDateRange(
    providerFilteredEvents,
    timezone,
    options.since,
    options.until,
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
