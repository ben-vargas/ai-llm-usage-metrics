import { createUsageEvent } from '../../domain/usage-event.js';
import type { UsageEvent } from '../../domain/usage-event.js';
import { asRecord } from '../../utils/as-record.js';
import { asTrimmedText, toNumberLike } from '../parsing-utils.js';
import type { SourceParseFileDiagnostics } from '../source-adapter.js';
import type { OpenCodeSqliteRow } from './opencode-sqlite-query.js';

const UNIX_SECONDS_ABS_CUTOFF = 10_000_000_000;

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

  return usageFields.some((value) => {
    const parsed = parseNonNegativeNumber(value);
    return parsed !== undefined && parsed > 0;
  });
}

export function parseOpenCodeMessageRows(
  rows: Iterable<OpenCodeSqliteRow>,
  sourceId: UsageEvent['source'],
): SourceParseFileDiagnostics {
  const events: UsageEvent[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const dataJson = asTrimmedText(row.data_json);

    if (!dataJson) {
      skippedRows += 1;
      continue;
    }

    let payload: Record<string, unknown>;

    try {
      payload = asRecord(JSON.parse(dataJson)) ?? {};
    } catch {
      skippedRows += 1;
      continue;
    }

    const role = asTrimmedText(payload.role) ?? asTrimmedText(payload.type);

    if (role?.toLowerCase() !== 'assistant') {
      continue;
    }

    const timestamp = resolveTimestamp(row.row_time, payload);

    if (!timestamp) {
      skippedRows += 1;
      continue;
    }

    const sessionId =
      asTrimmedText(row.row_session_id) ??
      asTrimmedText(payload.sessionID) ??
      asTrimmedText(payload.sessionId) ??
      asTrimmedText(payload.session_id) ??
      asTrimmedText(row.row_id);

    if (!sessionId) {
      skippedRows += 1;
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
      skippedRows += 1;
      continue;
    }

    try {
      events.push(
        createUsageEvent({
          source: sourceId,
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
      skippedRows += 1;
    }
  }

  return { events, skippedRows };
}
