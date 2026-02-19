import { access, constants } from 'node:fs/promises';

import { createUsageEvent } from '../../domain/usage-event.js';
import type { UsageEvent } from '../../domain/usage-event.js';
import { asRecord } from '../../utils/as-record.js';
import { asTrimmedText, toNumberLike } from '../parsing-utils.js';
import type { SourceAdapter } from '../source-adapter.js';
import { getDefaultOpenCodeDbPathCandidates } from './opencode-db-path-resolver.js';

const UNIX_SECONDS_ABS_CUTOFF = 10_000_000_000;
const DEFAULT_BUSY_RETRY_COUNT = 2;
const DEFAULT_BUSY_RETRY_DELAY_MS = 50;

type SqliteRow = Record<string, unknown>;

type SqliteStatement = {
  all: (...anonymousParameters: unknown[]) => SqliteRow[];
};

type SqliteDatabase = {
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

type SqliteModule = {
  DatabaseSync: new (
    filePath: string,
    options?: {
      readOnly?: boolean;
      timeout?: number;
    },
  ) => SqliteDatabase;
};

type PathPredicate = (filePath: string) => Promise<boolean>;
type SleepFn = (delayMs: number) => Promise<void>;

export type OpenCodeSourceAdapterOptions = {
  dbPath?: string;
  resolveDefaultDbPaths?: () => string[];
  pathExists?: PathPredicate;
  pathReadable?: PathPredicate;
  loadSqliteModule?: () => Promise<SqliteModule>;
  maxBusyRetries?: number;
  busyRetryDelayMs?: number;
  sleep?: SleepFn;
};

function isBlankText(value: string): boolean {
  return value.trim().length === 0;
}

function normalizeTimestampCandidate(candidate: unknown): string | undefined {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    const timestampMs =
      Math.abs(candidate) <= UNIX_SECONDS_ABS_CUTOFF ? candidate * 1000 : candidate;
    const date = new Date(timestampMs);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toISOString();
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();

    if (!trimmed) {
      return undefined;
    }

    const numericTimestamp = Number(trimmed);

    if (Number.isFinite(numericTimestamp)) {
      return normalizeTimestampCandidate(numericTimestamp);
    }

    const date = new Date(trimmed);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toISOString();
  }

  return undefined;
}

function resolveTimestamp(
  rowTimestamp: unknown,
  messagePayload: Record<string, unknown>,
): string | undefined {
  const timestampCandidates = [
    rowTimestamp,
    messagePayload.timestamp,
    messagePayload.timeCreated,
    messagePayload.time_created,
  ];

  for (const candidate of timestampCandidates) {
    const resolved = normalizeTimestampCandidate(candidate);

    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function parseNonNegativeNumber(value: unknown): number | undefined {
  const parsed = toNumberLike(value);

  if (parsed === undefined || parsed === null) {
    return undefined;
  }

  const numberValue = typeof parsed === 'number' ? parsed : Number(parsed);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return undefined;
  }

  return numberValue;
}

function hasUsageSignal(usageFields: Array<unknown>, explicitCost: number | undefined): boolean {
  if (explicitCost !== undefined) {
    return true;
  }

  return usageFields.some((value) => value !== undefined && value !== null);
}

function isBusyOrLockedError(error: unknown): boolean {
  const asError = asRecord(error);
  const code = asTrimmedText(asError?.code);
  const message = error instanceof Error ? error.message : String(error);
  const busySignal = /SQLITE_BUSY|SQLITE_LOCKED|database is locked|database table is locked/u;

  return (
    code === 'SQLITE_BUSY' ||
    code === 'SQLITE_LOCKED' ||
    code === 'ERR_SQLITE_BUSY' ||
    busySignal.test(message)
  );
}

function isJsonExtractUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such function:\s*json_extract/iu.test(message);
}

function formatSqliteError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const errorRecord = asRecord(error);
  const code = asTrimmedText(errorRecord?.code);

  if (!code) {
    return error.message;
  }

  return `${code}: ${error.message}`;
}

function escapeIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function resolveRequiredMessageColumns(messageColumns: ReadonlySet<string>): {
  idColumn: string;
  timestampColumn: string;
  dataColumn: string;
  sessionIdColumn: string | undefined;
} {
  if (!messageColumns.has('data')) {
    throw new Error(
      'OpenCode schema drift: "message.data" column not found. Inspect schema with `opencode db` commands.',
    );
  }

  const idColumn = messageColumns.has('id')
    ? 'id'
    : messageColumns.has('message_id')
      ? 'message_id'
      : undefined;
  const timestampColumn = messageColumns.has('time_created')
    ? 'time_created'
    : messageColumns.has('created_at')
      ? 'created_at'
      : messageColumns.has('timestamp')
        ? 'timestamp'
        : undefined;
  const sessionIdColumn = messageColumns.has('session_id')
    ? 'session_id'
    : messageColumns.has('sessionId')
      ? 'sessionId'
      : undefined;

  if (!idColumn || !timestampColumn) {
    throw new Error(
      'OpenCode schema drift: required message id/timestamp columns are unavailable. Inspect schema with `opencode db` commands.',
    );
  }

  return {
    idColumn,
    timestampColumn,
    dataColumn: 'data',
    sessionIdColumn,
  };
}

function createPrimaryQuery(columns: {
  idColumn: string;
  timestampColumn: string;
  dataColumn: string;
  sessionIdColumn: string | undefined;
}): string {
  const rowSessionId = columns.sessionIdColumn
    ? `${escapeIdentifier(columns.sessionIdColumn)} AS row_session_id`
    : 'NULL AS row_session_id';

  return [
    'SELECT',
    `  ${escapeIdentifier(columns.idColumn)} AS row_id,`,
    `  ${escapeIdentifier(columns.timestampColumn)} AS row_time,`,
    `  ${rowSessionId},`,
    `  ${escapeIdentifier(columns.dataColumn)} AS data_json`,
    `FROM ${escapeIdentifier('message')}`,
    `WHERE json_extract(${escapeIdentifier(columns.dataColumn)}, '$.role') = 'assistant'`,
    `ORDER BY ${escapeIdentifier(columns.timestampColumn)} ASC, ${escapeIdentifier(columns.idColumn)} ASC`,
  ].join('\n');
}

function createFallbackQuery(columns: {
  idColumn: string;
  timestampColumn: string;
  dataColumn: string;
  sessionIdColumn: string | undefined;
}): string {
  const rowSessionId = columns.sessionIdColumn
    ? `${escapeIdentifier(columns.sessionIdColumn)} AS row_session_id`
    : 'NULL AS row_session_id';

  return [
    'SELECT',
    `  ${escapeIdentifier(columns.idColumn)} AS row_id,`,
    `  ${escapeIdentifier(columns.timestampColumn)} AS row_time,`,
    `  ${rowSessionId},`,
    `  ${escapeIdentifier(columns.dataColumn)} AS data_json`,
    `FROM ${escapeIdentifier('message')}`,
    `ORDER BY ${escapeIdentifier(columns.timestampColumn)} ASC, ${escapeIdentifier(columns.idColumn)} ASC`,
  ].join('\n');
}

async function loadNodeSqliteModule(): Promise<SqliteModule> {
  try {
    return (await import('node:sqlite')) as unknown as SqliteModule;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `OpenCode source requires Node.js 24+ runtime with node:sqlite support: ${reason}`,
    );
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function pathReadable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function sleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export class OpenCodeSourceAdapter implements SourceAdapter {
  public readonly id = 'opencode' as const;

  private readonly explicitDbPath?: string;
  private readonly resolveDefaultDbPaths: () => string[];
  private readonly pathExists: PathPredicate;
  private readonly pathReadable: PathPredicate;
  private readonly loadSqliteModule: () => Promise<SqliteModule>;
  private readonly maxBusyRetries: number;
  private readonly busyRetryDelayMs: number;
  private readonly sleep: SleepFn;

  public constructor(options: OpenCodeSourceAdapterOptions = {}) {
    this.explicitDbPath = options.dbPath;
    this.resolveDefaultDbPaths =
      options.resolveDefaultDbPaths ?? getDefaultOpenCodeDbPathCandidates;
    this.pathExists = options.pathExists ?? pathExists;
    this.pathReadable = options.pathReadable ?? pathReadable;
    this.loadSqliteModule = options.loadSqliteModule ?? loadNodeSqliteModule;
    this.maxBusyRetries = Math.max(0, options.maxBusyRetries ?? DEFAULT_BUSY_RETRY_COUNT);
    this.busyRetryDelayMs = Math.max(1, options.busyRetryDelayMs ?? DEFAULT_BUSY_RETRY_DELAY_MS);
    this.sleep = options.sleep ?? sleep;
  }

  public async discoverFiles(): Promise<string[]> {
    if (this.explicitDbPath !== undefined) {
      if (isBlankText(this.explicitDbPath)) {
        throw new Error('--opencode-db must be a non-empty path');
      }

      const explicitDbPath = this.explicitDbPath.trim();
      const readable = await this.pathReadable(explicitDbPath);

      if (!readable) {
        throw new Error(`OpenCode DB path is missing or unreadable: ${explicitDbPath}`);
      }

      return [explicitDbPath];
    }

    for (const candidatePath of this.resolveDefaultDbPaths()) {
      if (await this.pathExists(candidatePath)) {
        return [candidatePath];
      }
    }

    return [];
  }

  public async parseFile(dbPath: string): Promise<UsageEvent[]> {
    if (isBlankText(dbPath)) {
      throw new Error('OpenCode DB path must be a non-empty path');
    }

    const normalizedDbPath = dbPath.trim();
    const readable = await this.pathReadable(normalizedDbPath);

    if (!readable) {
      throw new Error(`OpenCode DB path is unreadable: ${normalizedDbPath}`);
    }

    for (let attempt = 0; attempt <= this.maxBusyRetries; attempt += 1) {
      try {
        return await this.parseFileOnce(normalizedDbPath);
      } catch (error) {
        if (isBusyOrLockedError(error) && attempt < this.maxBusyRetries) {
          await this.sleep(this.busyRetryDelayMs * (attempt + 1));
          continue;
        }

        if (isBusyOrLockedError(error)) {
          throw new Error(
            `OpenCode DB is busy/locked: ${normalizedDbPath}. Retries exhausted after ${this.maxBusyRetries + 1} attempt(s). Close active OpenCode processes and retry.`,
          );
        }

        throw new Error(
          `Could not read OpenCode DB at ${normalizedDbPath}: ${formatSqliteError(error)}`,
        );
      }
    }

    return [];
  }

  private async parseFileOnce(dbPath: string): Promise<UsageEvent[]> {
    const sqlite = await this.loadSqliteModule();
    const database = new sqlite.DatabaseSync(dbPath, { readOnly: true, timeout: 0 });

    try {
      const tablesResult = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => asTrimmedText(row.name))
        .filter((value): value is string => Boolean(value));
      const tables = new Set(tablesResult);

      if (!tables.has('message')) {
        throw new Error(
          'OpenCode schema drift: required "message" table not found. Inspect schema with `opencode db` commands.',
        );
      }

      const messageColumns = new Set(
        database
          .prepare("PRAGMA table_info('message')")
          .all()
          .map((row) => asTrimmedText(row.name))
          .filter((value): value is string => Boolean(value)),
      );
      const columns = resolveRequiredMessageColumns(messageColumns);
      const primaryQuery = createPrimaryQuery(columns);

      let messageRows: SqliteRow[];

      try {
        messageRows = database.prepare(primaryQuery).all();
      } catch (error) {
        if (!isJsonExtractUnavailableError(error)) {
          throw error;
        }

        messageRows = database.prepare(createFallbackQuery(columns)).all();
      }

      const events: UsageEvent[] = [];

      for (const row of messageRows) {
        const dataJson = asTrimmedText(row.data_json);

        if (!dataJson) {
          continue;
        }

        let payload: Record<string, unknown>;

        try {
          payload = asRecord(JSON.parse(dataJson)) ?? {};
        } catch {
          continue;
        }

        const role = asTrimmedText(payload.role) ?? asTrimmedText(payload.type);

        if (role?.toLowerCase() !== 'assistant') {
          continue;
        }

        const timestamp = resolveTimestamp(row.row_time, payload);

        if (!timestamp) {
          continue;
        }

        const sessionId =
          asTrimmedText(row.row_session_id) ??
          asTrimmedText(payload.sessionID) ??
          asTrimmedText(payload.sessionId) ??
          asTrimmedText(payload.session_id) ??
          asTrimmedText(row.row_id);

        if (!sessionId) {
          continue;
        }

        const provider = asTrimmedText(payload.providerID) ?? asTrimmedText(payload.provider);
        const model = asTrimmedText(payload.modelID) ?? asTrimmedText(payload.model);
        const tokens = asRecord(payload.tokens);
        const tokenCache = asRecord(tokens?.cache);
        const inputTokens = toNumberLike(tokens?.input);
        const outputTokens = toNumberLike(tokens?.output);
        const reasoningTokens = toNumberLike(tokens?.reasoning);
        const cacheReadTokens = toNumberLike(tokenCache?.read);
        const cacheWriteTokens = toNumberLike(tokenCache?.write);
        const totalTokens = toNumberLike(tokens?.total);
        const explicitCost = parseNonNegativeNumber(payload.cost);

        if (
          !hasUsageSignal(
            [
              inputTokens,
              outputTokens,
              reasoningTokens,
              cacheReadTokens,
              cacheWriteTokens,
              totalTokens,
            ],
            explicitCost,
          )
        ) {
          continue;
        }

        try {
          events.push(
            createUsageEvent({
              source: this.id,
              sessionId,
              timestamp,
              provider,
              model,
              inputTokens,
              outputTokens,
              reasoningTokens,
              cacheReadTokens,
              cacheWriteTokens,
              totalTokens,
              costUsd: explicitCost,
              costMode: explicitCost === undefined ? 'estimated' : 'explicit',
            }),
          );
        } catch {
          continue;
        }
      }

      return events;
    } finally {
      database.close();
    }
  }
}
