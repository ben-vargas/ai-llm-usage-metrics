import os from 'node:os';
import path from 'node:path';

import { createUsageEvent } from '../../domain/usage-event.js';
import type { UsageEvent } from '../../domain/usage-event.js';
import type { NumberLike } from '../../domain/normalization.js';
import { asRecord } from '../../utils/as-record.js';
import { discoverJsonlFiles } from '../../utils/discover-jsonl-files.js';
import { readJsonlObjects } from '../../utils/read-jsonl-objects.js';
import { asTrimmedText, toNumberLike } from '../parsing-utils.js';
import type { SourceAdapter } from '../source-adapter.js';

const defaultSessionsDir = path.join(os.homedir(), '.pi', 'agent', 'sessions');

type ProviderFilter = (provider: string | undefined) => boolean;

type PiSessionState = {
  sessionId?: string;
  sessionTimestamp?: string;
  provider?: string;
  model?: string;
};

type PiUsageExtract = {
  inputTokens?: NumberLike;
  outputTokens?: NumberLike;
  reasoningTokens?: NumberLike;
  cacheReadTokens?: NumberLike;
  cacheWriteTokens?: NumberLike;
  totalTokens?: NumberLike;
  costUsd?: NumberLike;
};

export type PiSourceAdapterOptions = {
  sessionsDir?: string;
  providerFilter?: ProviderFilter;
};

const allowAllProviders: ProviderFilter = () => true;

const UNIX_SECONDS_ABS_CUTOFF = 10_000_000_000;

function normalizeTimestampCandidate(candidate: unknown): string | undefined {
  let date: Date | undefined;

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    const timestampMs =
      Math.abs(candidate) <= UNIX_SECONDS_ABS_CUTOFF ? candidate * 1000 : candidate;
    date = new Date(timestampMs);
  } else {
    const normalizedText = asTrimmedText(candidate);

    if (!normalizedText) {
      return undefined;
    }

    date = new Date(normalizedText);
  }

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function resolveTimestamp(
  line: Record<string, unknown>,
  message: Record<string, unknown> | undefined,
  state: PiSessionState,
): string | undefined {
  const candidates = [line.timestamp, message?.timestamp, state.sessionTimestamp];

  for (const candidate of candidates) {
    const normalizedTimestamp = normalizeTimestampCandidate(candidate);

    if (normalizedTimestamp) {
      return normalizedTimestamp;
    }
  }

  return undefined;
}

function extractUsageFromRecord(usage: Record<string, unknown>): PiUsageExtract | undefined {
  const cost = asRecord(usage.cost);

  const extracted: PiUsageExtract = {
    inputTokens: toNumberLike(usage.input),
    outputTokens: toNumberLike(usage.output),
    reasoningTokens: toNumberLike(
      usage.reasoning ?? usage.reasoningTokens ?? usage.reasoningOutput ?? usage.outputReasoning,
    ),
    cacheReadTokens: toNumberLike(usage.cacheRead),
    cacheWriteTokens: toNumberLike(usage.cacheWrite),
    totalTokens: toNumberLike(usage.totalTokens),
    costUsd: toNumberLike(cost?.total),
  };

  const hasKnownUsageField =
    extracted.inputTokens !== undefined ||
    extracted.outputTokens !== undefined ||
    extracted.reasoningTokens !== undefined ||
    extracted.cacheReadTokens !== undefined ||
    extracted.cacheWriteTokens !== undefined ||
    extracted.totalTokens !== undefined ||
    extracted.costUsd !== undefined;

  return hasKnownUsageField ? extracted : undefined;
}

function extractUsage(line: Record<string, unknown>, message: Record<string, unknown> | undefined) {
  const lineUsage = asRecord(line.usage);
  const messageUsage = asRecord(message?.usage);

  if (lineUsage) {
    const extractedLineUsage = extractUsageFromRecord(lineUsage);

    if (extractedLineUsage) {
      return extractedLineUsage;
    }
  }

  if (!messageUsage) {
    return undefined;
  }

  return extractUsageFromRecord(messageUsage);
}

function getFallbackSessionId(filePath: string): string {
  return path.basename(filePath, '.jsonl');
}

export class PiSourceAdapter implements SourceAdapter {
  public readonly id = 'pi' as const;

  private readonly sessionsDir: string;
  private readonly providerFilter: ProviderFilter;

  public constructor(options: PiSourceAdapterOptions = {}) {
    this.sessionsDir = options.sessionsDir ?? defaultSessionsDir;
    this.providerFilter = options.providerFilter ?? allowAllProviders;
  }

  public async discoverFiles(): Promise<string[]> {
    return discoverJsonlFiles(this.sessionsDir);
  }

  public async parseFile(filePath: string): Promise<UsageEvent[]> {
    const events: UsageEvent[] = [];
    const state: PiSessionState = { sessionId: getFallbackSessionId(filePath) };

    for await (const line of readJsonlObjects(filePath)) {
      if (line.type === 'session') {
        state.sessionId = asTrimmedText(line.id) ?? state.sessionId;
        state.sessionTimestamp = asTrimmedText(line.timestamp) ?? state.sessionTimestamp;
        continue;
      }

      if (line.type === 'model_change') {
        state.provider = asTrimmedText(line.provider) ?? state.provider;
        state.model = asTrimmedText(line.modelId) ?? asTrimmedText(line.model) ?? state.model;
        continue;
      }

      if (line.type !== 'message') {
        continue;
      }

      const message = asRecord(line.message);
      const usage = extractUsage(line, message);

      if (!usage) {
        continue;
      }

      const provider =
        asTrimmedText(line.provider) ?? asTrimmedText(message?.provider) ?? state.provider;

      if (!this.providerFilter(provider)) {
        continue;
      }

      const timestamp = resolveTimestamp(line, message, state);

      if (!timestamp || !state.sessionId) {
        continue;
      }

      const model =
        asTrimmedText(line.model) ??
        asTrimmedText(line.modelId) ??
        asTrimmedText(message?.model) ??
        state.model;

      try {
        events.push(
          createUsageEvent({
            source: this.id,
            sessionId: state.sessionId,
            timestamp,
            provider,
            model,
            ...usage,
          }),
        );
      } catch {
        continue;
      }
    }

    return events;
  }
}

export function getDefaultPiSessionsDir(): string {
  return defaultSessionsDir;
}
