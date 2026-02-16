import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createUsageEvent, type UsageEvent } from '../../domain/usage-event.js';
import { normalizeNonNegativeInteger } from '../../domain/normalization.js';
import { discoverJsonlFiles } from '../../utils/discover-jsonl-files.js';
import type { SourceAdapter } from '../source-adapter.js';

const defaultSessionsDir = path.join(os.homedir(), '.codex', 'sessions');

export const LEGACY_CODEX_MODEL_FALLBACK = 'legacy-codex-unknown';

type CodexUsage = {
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type CodexSessionState = {
  sessionId: string;
  provider?: string;
  model?: string;
  previousTotalUsage?: CodexUsage;
};

export type CodexSourceAdapterOptions = {
  sessionsDir?: string;
};

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

function toUsage(value: unknown): CodexUsage | undefined {
  const usage = asRecord(value);

  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: normalizeNonNegativeInteger(usage.input_tokens),
    cacheReadTokens: normalizeNonNegativeInteger(usage.cached_input_tokens),
    outputTokens: normalizeNonNegativeInteger(usage.output_tokens),
    reasoningTokens: normalizeNonNegativeInteger(usage.reasoning_output_tokens),
    totalTokens: normalizeNonNegativeInteger(usage.total_tokens),
  };
}

function subtractUsage(current: CodexUsage, previous: CodexUsage): CodexUsage {
  return {
    inputTokens: Math.max(0, current.inputTokens - previous.inputTokens),
    cacheReadTokens: Math.max(0, current.cacheReadTokens - previous.cacheReadTokens),
    outputTokens: Math.max(0, current.outputTokens - previous.outputTokens),
    reasoningTokens: Math.max(0, current.reasoningTokens - previous.reasoningTokens),
    totalTokens: Math.max(0, current.totalTokens - previous.totalTokens),
  };
}

function addUsage(left: CodexUsage, right: CodexUsage): CodexUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

function hasUsageSignal(usage: CodexUsage): boolean {
  return (
    usage.inputTokens > 0 ||
    usage.cacheReadTokens > 0 ||
    usage.outputTokens > 0 ||
    usage.reasoningTokens > 0 ||
    usage.totalTokens > 0
  );
}

function deriveDeltaUsage(
  info: Record<string, unknown>,
  previousTotalUsage: CodexUsage | undefined,
): { deltaUsage?: CodexUsage; latestTotalUsage?: CodexUsage } {
  const totalUsage = toUsage(info.total_token_usage);
  const lastUsage = toUsage(info.last_token_usage);

  if (lastUsage) {
    return { deltaUsage: lastUsage, latestTotalUsage: totalUsage ?? previousTotalUsage };
  }

  if (!totalUsage) {
    return {};
  }

  const deltaUsage = previousTotalUsage
    ? subtractUsage(totalUsage, previousTotalUsage)
    : totalUsage;

  return { deltaUsage, latestTotalUsage: totalUsage };
}

function getFallbackSessionId(filePath: string): string {
  return path.basename(filePath, '.jsonl');
}

export class CodexSourceAdapter implements SourceAdapter {
  public readonly id = 'codex' as const;

  private readonly sessionsDir: string;

  public constructor(options: CodexSourceAdapterOptions = {}) {
    this.sessionsDir = options.sessionsDir ?? defaultSessionsDir;
  }

  public async discoverFiles(): Promise<string[]> {
    return discoverJsonlFiles(this.sessionsDir);
  }

  public async parseFile(filePath: string): Promise<UsageEvent[]> {
    const content = await readFile(filePath, 'utf8');
    const events: UsageEvent[] = [];

    const state: CodexSessionState = {
      sessionId: getFallbackSessionId(filePath),
      provider: 'openai',
    };

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

      if (line.type === 'session_meta') {
        const payload = asRecord(line.payload);
        state.sessionId = asText(payload?.id) ?? state.sessionId;
        state.provider = asText(payload?.model_provider) ?? state.provider;
        continue;
      }

      if (line.type === 'turn_context') {
        const payload = asRecord(line.payload);
        state.model = asText(payload?.model) ?? state.model;
        continue;
      }

      if (line.type !== 'event_msg') {
        continue;
      }

      const payload = asRecord(line.payload);

      if (payload?.type !== 'token_count') {
        continue;
      }

      const info = asRecord(payload.info);

      if (!info) {
        continue;
      }

      const { deltaUsage, latestTotalUsage } = deriveDeltaUsage(info, state.previousTotalUsage);

      if (!deltaUsage || !hasUsageSignal(deltaUsage)) {
        state.previousTotalUsage = latestTotalUsage ?? state.previousTotalUsage;
        continue;
      }

      const timestamp = asText(line.timestamp);

      if (!timestamp) {
        state.previousTotalUsage = latestTotalUsage ?? state.previousTotalUsage;
        continue;
      }

      const model = state.model ?? LEGACY_CODEX_MODEL_FALLBACK;

      try {
        events.push(
          createUsageEvent({
            source: this.id,
            sessionId: state.sessionId,
            timestamp,
            provider: state.provider,
            model,
            inputTokens: deltaUsage.inputTokens,
            outputTokens: deltaUsage.outputTokens,
            reasoningTokens: deltaUsage.reasoningTokens,
            cacheReadTokens: deltaUsage.cacheReadTokens,
            cacheWriteTokens: 0,
            totalTokens: deltaUsage.totalTokens,
            costMode: 'estimated',
          }),
        );
      } catch {
        // no-op: malformed lines are ignored by design
      }

      if (latestTotalUsage) {
        state.previousTotalUsage = latestTotalUsage;
      } else if (state.previousTotalUsage) {
        state.previousTotalUsage = addUsage(state.previousTotalUsage, deltaUsage);
      } else {
        state.previousTotalUsage = deltaUsage;
      }
    }

    return events;
  }
}

export function getDefaultCodexSessionsDir(): string {
  return defaultSessionsDir;
}
