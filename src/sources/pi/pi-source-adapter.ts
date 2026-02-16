import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createUsageEvent } from '../../domain/usage-event.js';
import type { UsageEvent } from '../../domain/usage-event.js';
import type { NumberLike } from '../../domain/normalization.js';
import type { SourceAdapter } from '../source-adapter.js';
import { discoverJsonlFiles } from '../../utils/discover-jsonl-files.js';

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

export function isOpenAiProvider(provider: string | undefined): boolean {
  return provider?.toLowerCase().includes('openai') ?? false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function asNumberLike(value: unknown): NumberLike {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }

  return undefined;
}

function resolveTimestamp(
  line: Record<string, unknown>,
  message: Record<string, unknown> | undefined,
  state: PiSessionState,
): string | undefined {
  const candidates = [line.timestamp, message?.timestamp, state.sessionTimestamp];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return new Date(candidate).toISOString();
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return undefined;
}

function extractUsage(line: Record<string, unknown>, message: Record<string, unknown> | undefined) {
  const usage = asRecord(line.usage ?? message?.usage);

  if (!usage) {
    return undefined;
  }

  const cost = asRecord(usage.cost);

  const extracted: PiUsageExtract = {
    inputTokens: asNumberLike(usage.input),
    outputTokens: asNumberLike(usage.output),
    reasoningTokens: asNumberLike(
      usage.reasoning ?? usage.reasoningTokens ?? usage.reasoningOutput ?? usage.outputReasoning,
    ),
    cacheReadTokens: asNumberLike(usage.cacheRead),
    cacheWriteTokens: asNumberLike(usage.cacheWrite),
    totalTokens: asNumberLike(usage.totalTokens),
    costUsd: asNumberLike(cost?.total),
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

function getFallbackSessionId(filePath: string): string {
  return path.basename(filePath, '.jsonl');
}

export class PiSourceAdapter implements SourceAdapter {
  public readonly id = 'pi' as const;

  private readonly sessionsDir: string;
  private readonly providerFilter: ProviderFilter;

  public constructor(options: PiSourceAdapterOptions = {}) {
    this.sessionsDir = options.sessionsDir ?? defaultSessionsDir;
    this.providerFilter = options.providerFilter ?? isOpenAiProvider;
  }

  public async discoverFiles(): Promise<string[]> {
    return discoverJsonlFiles(this.sessionsDir);
  }

  public async parseFile(filePath: string): Promise<UsageEvent[]> {
    const content = await readFile(filePath, 'utf8');
    const events: UsageEvent[] = [];
    const state: PiSessionState = { sessionId: getFallbackSessionId(filePath) };

    for (const rawLine of content.split(/\r?\n/u)) {
      const lineText = rawLine.trim();

      if (!lineText) {
        continue;
      }

      let parsedLine: unknown;

      try {
        parsedLine = JSON.parse(lineText);
      } catch {
        continue;
      }

      const line = asRecord(parsedLine);

      if (!line) {
        continue;
      }

      if (line.type === 'session') {
        state.sessionId = asText(line.id) ?? state.sessionId;
        state.sessionTimestamp = asText(line.timestamp) ?? state.sessionTimestamp;
        continue;
      }

      if (line.type === 'model_change') {
        state.provider = asText(line.provider) ?? state.provider;
        state.model = asText(line.modelId) ?? asText(line.model) ?? state.model;
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

      const provider = asText(line.provider) ?? asText(message?.provider) ?? state.provider;

      if (!this.providerFilter(provider)) {
        continue;
      }

      const timestamp = resolveTimestamp(line, message, state);

      if (!timestamp || !state.sessionId) {
        continue;
      }

      const model =
        asText(line.model) ?? asText(line.modelId) ?? asText(message?.model) ?? state.model;

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
