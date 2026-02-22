import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizeSourceId, type UsageEvent } from '../domain/usage-event.js';
import type {
  SourceParseFileDiagnostics,
  SourceSkippedRowReasonStat,
} from '../sources/source-adapter.js';
import { normalizeSkippedRowReasons } from './normalize-skipped-row-reasons.js';
import { asRecord } from '../utils/as-record.js';
import { getUserCacheRootDir } from '../utils/cache-root-dir.js';

const PARSE_FILE_CACHE_VERSION = 1;
const CACHE_KEY_SEPARATOR = '\u0000';

export type ParseFileFingerprint = {
  size: number;
  mtimeMs: number;
};

export type ParseFileCacheLimits = {
  ttlMs: number;
  maxEntries: number;
  maxBytes: number;
};

type ParseFileCacheEntry = {
  source: string;
  filePath: string;
  fingerprint: ParseFileFingerprint;
  cachedAt: number;
  diagnostics: SourceParseFileDiagnostics;
};

type ParseFileCachePayload = {
  version: number;
  entries: ParseFileCacheEntry[];
};

function createCacheKey(source: string, filePath: string): string {
  return `${source}${CACHE_KEY_SEPARATOR}${filePath}`;
}

function toNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.trunc(value);
}

function toNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function normalizeCachedUsageEvent(value: unknown): UsageEvent | undefined {
  const record = asRecord(value);

  if (!record) {
    return undefined;
  }

  const source = normalizeSourceId(record.source);
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId.trim() : '';
  const timestamp = typeof record.timestamp === 'string' ? record.timestamp.trim() : '';

  if (!source || !sessionId || !timestamp) {
    return undefined;
  }

  if (Number.isNaN(new Date(timestamp).getTime())) {
    return undefined;
  }

  const costMode =
    record.costMode === 'explicit' || record.costMode === 'estimated' ? record.costMode : undefined;

  if (!costMode) {
    return undefined;
  }

  const inputTokens = toNonNegativeInteger(record.inputTokens);
  const outputTokens = toNonNegativeInteger(record.outputTokens);
  const reasoningTokens = toNonNegativeInteger(record.reasoningTokens);
  const cacheReadTokens = toNonNegativeInteger(record.cacheReadTokens);
  const cacheWriteTokens = toNonNegativeInteger(record.cacheWriteTokens);
  const totalTokens = toNonNegativeInteger(record.totalTokens);

  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    reasoningTokens === undefined ||
    cacheReadTokens === undefined ||
    cacheWriteTokens === undefined ||
    totalTokens === undefined
  ) {
    return undefined;
  }

  const provider = typeof record.provider === 'string' ? record.provider.trim() : '';
  const model = typeof record.model === 'string' ? record.model.trim() : '';
  const costUsd = toNonNegativeNumber(record.costUsd);

  if (costMode === 'explicit' && costUsd === undefined) {
    return undefined;
  }

  return {
    source,
    sessionId,
    timestamp,
    provider: provider || undefined,
    model: model || undefined,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    costUsd,
    costMode,
  };
}

function cloneUsageEvent(event: UsageEvent): UsageEvent {
  return { ...event };
}

function cloneUsageEvents(events: UsageEvent[]): UsageEvent[] {
  return events.map((event) => cloneUsageEvent(event));
}

function cloneSkippedRowReasons(
  skippedRowReasons: SourceSkippedRowReasonStat[] | undefined,
): SourceSkippedRowReasonStat[] {
  return (skippedRowReasons ?? []).map((stat) => ({ reason: stat.reason, count: stat.count }));
}

function normalizeCachedEvents(value: unknown): UsageEvent[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedEvents: UsageEvent[] = [];

  for (const event of value) {
    const normalizedEvent = normalizeCachedUsageEvent(event);

    if (!normalizedEvent) {
      return undefined;
    }

    normalizedEvents.push(normalizedEvent);
  }

  return normalizedEvents;
}

function normalizeCacheEntry(value: unknown): ParseFileCacheEntry | undefined {
  const record = asRecord(value);

  if (!record) {
    return undefined;
  }

  const source = typeof record.source === 'string' ? record.source.trim() : '';
  const filePath = typeof record.filePath === 'string' ? record.filePath.trim() : '';
  const cachedAt = toNonNegativeInteger(record.cachedAt);
  const fingerprint = asRecord(record.fingerprint);
  const diagnostics = asRecord(record.diagnostics);
  const size = toNonNegativeInteger(fingerprint?.size);
  const mtimeMs = toNonNegativeNumber(fingerprint?.mtimeMs);
  const skippedRows = toNonNegativeInteger(diagnostics?.skippedRows) ?? 0;
  const events = normalizeCachedEvents(diagnostics?.events);

  if (
    !source ||
    !filePath ||
    size === undefined ||
    mtimeMs === undefined ||
    cachedAt === undefined
  ) {
    return undefined;
  }

  if (!events) {
    return undefined;
  }

  return {
    source,
    filePath,
    fingerprint: { size, mtimeMs },
    cachedAt,
    diagnostics: {
      events,
      skippedRows,
      skippedRowReasons: normalizeSkippedRowReasons(diagnostics?.skippedRowReasons),
    },
  };
}

export function getDefaultParseFileCachePath(): string {
  return path.join(getUserCacheRootDir(), 'llm-usage-metrics', 'parse-file-cache.json');
}

export class ParseFileCache {
  private readonly entriesByKey = new Map<string, ParseFileCacheEntry>();
  private dirty = false;

  private constructor(
    private readonly cacheFilePath: string,
    private readonly limits: ParseFileCacheLimits,
    private readonly now: () => number,
  ) {}

  public static async load(options: {
    cacheFilePath?: string;
    limits: ParseFileCacheLimits;
    now?: () => number;
  }): Promise<ParseFileCache> {
    const cache = new ParseFileCache(
      options.cacheFilePath ?? getDefaultParseFileCachePath(),
      options.limits,
      options.now ?? Date.now,
    );
    await cache.loadFromDisk();
    return cache;
  }

  public get(
    source: string,
    filePath: string,
    fingerprint: ParseFileFingerprint,
  ): SourceParseFileDiagnostics | undefined {
    const entry = this.entriesByKey.get(createCacheKey(source, filePath));

    if (!entry) {
      return undefined;
    }

    if (entry.cachedAt + this.limits.ttlMs < this.now()) {
      this.entriesByKey.delete(createCacheKey(source, filePath));
      this.dirty = true;
      return undefined;
    }

    if (
      entry.fingerprint.size !== fingerprint.size ||
      entry.fingerprint.mtimeMs !== fingerprint.mtimeMs
    ) {
      return undefined;
    }

    return {
      events: cloneUsageEvents(entry.diagnostics.events),
      skippedRows: entry.diagnostics.skippedRows,
      skippedRowReasons: cloneSkippedRowReasons(entry.diagnostics.skippedRowReasons),
    };
  }

  public set(
    source: string,
    filePath: string,
    fingerprint: ParseFileFingerprint,
    diagnostics: SourceParseFileDiagnostics,
  ): void {
    this.entriesByKey.set(createCacheKey(source, filePath), {
      source,
      filePath,
      fingerprint: {
        size: fingerprint.size,
        mtimeMs: fingerprint.mtimeMs,
      },
      cachedAt: this.now(),
      diagnostics: {
        events: cloneUsageEvents(diagnostics.events),
        skippedRows: diagnostics.skippedRows,
        skippedRowReasons: cloneSkippedRowReasons(diagnostics.skippedRowReasons),
      },
    });
    this.dirty = true;
  }

  public async persist(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    const sortedEntries = [...this.entriesByKey.values()]
      .filter((entry) => entry.cachedAt + this.limits.ttlMs >= this.now())
      .sort((left, right) => right.cachedAt - left.cachedAt);

    const keptEntries = sortedEntries.slice(0, this.limits.maxEntries);
    let payloadText = JSON.stringify(this.toPayload(keptEntries));

    if (Buffer.byteLength(payloadText, 'utf8') > this.limits.maxBytes) {
      let bestCount = 0;
      let bestPayloadText = JSON.stringify(this.toPayload([]));
      let low = 0;
      let high = keptEntries.length;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidateText = JSON.stringify(this.toPayload(keptEntries.slice(0, mid)));

        if (Buffer.byteLength(candidateText, 'utf8') <= this.limits.maxBytes) {
          bestCount = mid;
          bestPayloadText = candidateText;
          low = mid + 1;
          continue;
        }

        high = mid - 1;
      }

      keptEntries.length = bestCount;
      payloadText = bestPayloadText;
    }

    await mkdir(path.dirname(this.cacheFilePath), { recursive: true });
    await writeFile(this.cacheFilePath, payloadText, 'utf8');
    this.dirty = false;
  }

  private toPayload(entries: ParseFileCacheEntry[]): ParseFileCachePayload {
    return {
      version: PARSE_FILE_CACHE_VERSION,
      entries: entries.map((entry) => ({
        source: entry.source,
        filePath: entry.filePath,
        fingerprint: entry.fingerprint,
        cachedAt: entry.cachedAt,
        diagnostics: {
          events: entry.diagnostics.events,
          skippedRows: entry.diagnostics.skippedRows,
          skippedRowReasons: cloneSkippedRowReasons(entry.diagnostics.skippedRowReasons),
        },
      })),
    };
  }

  private async loadFromDisk(): Promise<void> {
    let content: string;

    try {
      content = await readFile(this.cacheFilePath, 'utf8');
    } catch {
      return;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(content);
    } catch {
      this.dirty = true;
      return;
    }

    const payloadRecord = asRecord(parsedPayload);

    if (!payloadRecord) {
      this.dirty = true;
      return;
    }

    const version = toNonNegativeInteger(payloadRecord.version);

    if (version !== PARSE_FILE_CACHE_VERSION) {
      this.dirty = true;
      return;
    }

    if (Buffer.byteLength(content, 'utf8') > this.limits.maxBytes) {
      this.dirty = true;
    }

    const entries = Array.isArray(payloadRecord.entries) ? payloadRecord.entries : [];

    for (const rawEntry of entries) {
      const normalizedEntry = normalizeCacheEntry(rawEntry);

      if (!normalizedEntry) {
        this.dirty = true;
        continue;
      }

      if (normalizedEntry.cachedAt + this.limits.ttlMs < this.now()) {
        this.dirty = true;
        continue;
      }

      this.entriesByKey.set(
        createCacheKey(normalizedEntry.source, normalizedEntry.filePath),
        normalizedEntry,
      );
    }

    if (this.entriesByKey.size > this.limits.maxEntries) {
      this.dirty = true;
    }
  }
}
