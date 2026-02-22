import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { UsageEvent } from '../domain/usage-event.js';
import type {
  SourceParseFileDiagnostics,
  SourceSkippedRowReasonStat,
} from '../sources/source-adapter.js';
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
  writtenAt: number;
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

function normalizeSkippedRowReasons(value: unknown): SourceSkippedRowReasonStat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const record = asRecord(entry);

    if (!record) {
      return [];
    }

    const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
    const count = toNonNegativeInteger(record.count);

    if (!reason || count === undefined || count <= 0) {
      return [];
    }

    return [{ reason, count }];
  });
}

function normalizeCachedUsageEvent(value: unknown): UsageEvent | undefined {
  const record = asRecord(value);

  if (!record) {
    return undefined;
  }

  const source = typeof record.source === 'string' ? record.source.trim() : '';
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId.trim() : '';
  const timestamp = typeof record.timestamp === 'string' ? record.timestamp.trim() : '';

  if (!source || !sessionId || !timestamp) {
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
  const size = toNonNegativeInteger(record.size);
  const mtimeMs = toNonNegativeInteger(record.mtimeMs);
  const cachedAt = toNonNegativeInteger(record.cachedAt);
  const skippedRows = toNonNegativeInteger(record.skippedRows) ?? 0;
  const events = normalizeCachedEvents(record.events);

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
      skippedRowReasons: normalizeSkippedRowReasons(record.skippedRowReasons),
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
      events: [...entry.diagnostics.events],
      skippedRows: entry.diagnostics.skippedRows,
      skippedRowReasons: [...(entry.diagnostics.skippedRowReasons ?? [])],
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
        events: [...diagnostics.events],
        skippedRows: diagnostics.skippedRows,
        skippedRowReasons: [...(diagnostics.skippedRowReasons ?? [])],
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

    const keptEntries: ParseFileCacheEntry[] = [];

    for (const entry of sortedEntries) {
      if (keptEntries.length >= this.limits.maxEntries) {
        break;
      }

      keptEntries.push(entry);
    }

    let payload = this.toPayload(keptEntries);
    let payloadText = JSON.stringify(payload);

    while (
      Buffer.byteLength(payloadText, 'utf8') > this.limits.maxBytes &&
      keptEntries.length > 0
    ) {
      keptEntries.pop();
      payload = this.toPayload(keptEntries);
      payloadText = JSON.stringify(payload);
    }

    await mkdir(path.dirname(this.cacheFilePath), { recursive: true });
    await writeFile(this.cacheFilePath, payloadText, 'utf8');
    this.dirty = false;
  }

  private toPayload(entries: ParseFileCacheEntry[]): ParseFileCachePayload {
    return {
      version: PARSE_FILE_CACHE_VERSION,
      writtenAt: this.now(),
      entries: entries.map((entry) => ({
        source: entry.source,
        filePath: entry.filePath,
        fingerprint: entry.fingerprint,
        cachedAt: entry.cachedAt,
        diagnostics: {
          events: entry.diagnostics.events,
          skippedRows: entry.diagnostics.skippedRows,
          skippedRowReasons: entry.diagnostics.skippedRowReasons ?? [],
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

    const entries = Array.isArray(payloadRecord.entries) ? payloadRecord.entries : [];

    for (const rawEntry of entries) {
      const legacyEntryRecord = asRecord(rawEntry);
      const normalizedEntry = normalizeCacheEntry(
        legacyEntryRecord
          ? {
              source: legacyEntryRecord.source,
              filePath: legacyEntryRecord.filePath,
              size: asRecord(legacyEntryRecord.fingerprint)?.size ?? legacyEntryRecord.size,
              mtimeMs:
                asRecord(legacyEntryRecord.fingerprint)?.mtimeMs ?? legacyEntryRecord.mtimeMs,
              cachedAt: legacyEntryRecord.cachedAt,
              skippedRows:
                asRecord(legacyEntryRecord.diagnostics)?.skippedRows ??
                legacyEntryRecord.skippedRows,
              skippedRowReasons:
                asRecord(legacyEntryRecord.diagnostics)?.skippedRowReasons ??
                legacyEntryRecord.skippedRowReasons,
              events: asRecord(legacyEntryRecord.diagnostics)?.events ?? legacyEntryRecord.events,
            }
          : rawEntry,
      );

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
  }
}
