import type { UsageEvent } from '../domain/usage-event.js';
import type { SourceAdapter, SourceParseFileDiagnostics } from '../sources/source-adapter.js';
import { getPeriodKey } from '../utils/time-buckets.js';

import type { UsageSourceFailure } from './usage-data-contracts.js';

export type AdapterParseResult = {
  source: string;
  events: UsageEvent[];
  filesFound: number;
  skippedRows: number;
};

export type ParsedAdaptersResult = {
  successfulParseResults: AdapterParseResult[];
  sourceFailures: UsageSourceFailure[];
};

function getDefaultParseFileDiagnostics(events: UsageEvent[]): SourceParseFileDiagnostics {
  return { events, skippedRows: 0 };
}

function normalizeSkippedRowsCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export async function parseAdapterEvents(
  adapter: SourceAdapter,
  maxParallelFileParsing: number,
): Promise<AdapterParseResult> {
  const files = await adapter.discoverFiles();

  if (files.length === 0) {
    return { source: adapter.id, events: [], filesFound: 0, skippedRows: 0 };
  }

  const safeMaxParallelFileParsing =
    Number.isFinite(maxParallelFileParsing) && maxParallelFileParsing > 0
      ? Math.max(1, Math.floor(maxParallelFileParsing))
      : 1;
  const parsedByFile: UsageEvent[][] = Array.from({ length: files.length }, () => []);
  const skippedRowsByFile: number[] = Array.from({ length: files.length }, () => 0);
  const workerCount = Math.min(safeMaxParallelFileParsing, files.length);
  let nextFileIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextFileIndex < files.length) {
      const fileIndex = nextFileIndex;
      nextFileIndex += 1;

      const parseFileDiagnostics = adapter.parseFileWithDiagnostics
        ? await adapter.parseFileWithDiagnostics(files[fileIndex])
        : getDefaultParseFileDiagnostics(await adapter.parseFile(files[fileIndex]));

      parsedByFile[fileIndex] = parseFileDiagnostics.events;
      skippedRowsByFile[fileIndex] = normalizeSkippedRowsCount(parseFileDiagnostics.skippedRows);
    }
  });

  await Promise.all(workers);

  return {
    source: adapter.id,
    events: parsedByFile.flat(),
    filesFound: files.length,
    skippedRows: skippedRowsByFile.reduce((sum, skippedRowsCount) => sum + skippedRowsCount, 0),
  };
}

function getErrorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function parseSelectedAdapters(
  adaptersToParse: SourceAdapter[],
  maxParallelFileParsing: number,
): Promise<ParsedAdaptersResult> {
  const parseResults = await Promise.allSettled(
    adaptersToParse.map((adapter) => parseAdapterEvents(adapter, maxParallelFileParsing)),
  );
  const sourceFailures: UsageSourceFailure[] = [];
  const successfulParseResults: AdapterParseResult[] = [];

  for (const [index, parseResult] of parseResults.entries()) {
    const source = adaptersToParse[index].id;

    if (parseResult.status === 'fulfilled') {
      successfulParseResults.push(parseResult.value);
      continue;
    }

    sourceFailures.push({ source, reason: getErrorReason(parseResult.reason) });
  }

  return {
    successfulParseResults,
    sourceFailures,
  };
}

export function throwOnExplicitSourceFailures(
  sourceFailures: UsageSourceFailure[],
  explicitSourceIds: ReadonlySet<string>,
): void {
  const explicitFailures = sourceFailures.filter((failure) =>
    explicitSourceIds.has(failure.source.toLowerCase()),
  );

  if (explicitFailures.length === 0) {
    return;
  }

  const details = explicitFailures
    .map((failure) => `${failure.source}: ${failure.reason}`)
    .join('; ');

  throw new Error(`Failed to parse explicitly requested source(s): ${details}`);
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

export type UsageEventFilterOptions = {
  timezone: string;
  since?: string;
  until?: string;
  providerFilter?: string;
  modelFilter?: string[];
};

export function filterUsageEvents(
  events: UsageEvent[],
  options: UsageEventFilterOptions,
): UsageEvent[] {
  const providerFilteredEvents = events.filter((event) =>
    matchesProvider(event.provider, options.providerFilter),
  );
  const providerAndDateFilteredEvents = filterEventsByDateRange(
    providerFilteredEvents,
    options.timezone,
    options.since,
    options.until,
  );
  const modelFilterRules = resolveModelFilterRules(
    providerAndDateFilteredEvents,
    options.modelFilter,
  );

  return providerAndDateFilteredEvents.filter((event) =>
    matchesModel(event.model, modelFilterRules),
  );
}

export function filterParsedAdapterEvents(
  parseResults: AdapterParseResult[],
  options: UsageEventFilterOptions,
): UsageEvent[] {
  return filterUsageEvents(
    parseResults.flatMap((result) => result.events),
    options,
  );
}
