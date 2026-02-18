import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildUsageData } from '../../src/cli/build-usage-data.js';
import type { PricingLoadResult } from '../../src/cli/usage-data-contracts.js';
import { createUsageEvent } from '../../src/domain/usage-event.js';
import { createDefaultOpenAiPricingSource } from '../../src/pricing/static-pricing-source.js';
import type { SourceAdapter } from '../../src/sources/source-adapter.js';

const tempDirs: string[] = [];
const originalXdgCacheHome = process.env.XDG_CACHE_HOME;

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;

  if (originalXdgCacheHome === undefined) {
    delete process.env.XDG_CACHE_HOME;
  } else {
    process.env.XDG_CACHE_HOME = originalXdgCacheHome;
  }

  vi.unstubAllGlobals();
});

function createAdapter(
  id: SourceAdapter['id'],
  eventsByFile: Record<string, ReturnType<typeof createUsageEvent>[]>,
): SourceAdapter {
  const files = Object.keys(eventsByFile);

  return {
    id,
    discoverFiles: async () => files,
    parseFile: async (filePath) => eventsByFile[filePath] ?? [],
  };
}

function createEvent(
  overrides: Partial<Parameters<typeof createUsageEvent>[0]> = {},
): ReturnType<typeof createUsageEvent> {
  return createUsageEvent({
    source: 'pi',
    sessionId: 'session-1',
    timestamp: '2026-02-14T10:00:00.000Z',
    provider: 'openai',
    model: 'gpt-4.1',
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 15,
    costMode: 'explicit',
    costUsd: 0.03,
    ...overrides,
  });
}

function withDeterministicRuntimeDeps() {
  return {
    getParsingRuntimeConfig: () => ({ maxParallelFileParsing: 2 }),
    getPricingFetcherRuntimeConfig: () => ({ cacheTtlMs: 1_000, fetchTimeoutMs: 1_000 }),
    getActiveEnvVarOverrides: () => [],
  };
}

describe('buildUsageData', () => {
  it('returns no-sessions diagnostics without loading pricing', async () => {
    const pricingLoaderSpy = vi.fn(async (): Promise<PricingLoadResult> => {
      throw new Error('pricing should not be loaded when there are no events');
    });

    const result = await buildUsageData(
      'daily',
      {
        timezone: 'UTC',
      },
      {
        ...withDeterministicRuntimeDeps(),
        createAdapters: () => [createAdapter('pi', {}), createAdapter('codex', {})],
        resolvePricingSource: pricingLoaderSpy,
      },
    );

    expect(pricingLoaderSpy).not.toHaveBeenCalled();
    expect(result.diagnostics).toMatchObject({
      sessionStats: [
        { source: 'pi', filesFound: 0, eventsParsed: 0 },
        { source: 'codex', filesFound: 0, eventsParsed: 0 },
      ],
      pricingOrigin: 'none',
      timezone: 'UTC',
    });
    expect(result.rows).toEqual([
      {
        rowType: 'grand_total',
        periodKey: 'ALL',
        source: 'combined',
        models: [],
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      },
    ]);
  });

  it('supports source filtering and preserves adapter order in session diagnostics', async () => {
    const result = await buildUsageData(
      'daily',
      {
        timezone: 'UTC',
        source: 'codex',
      },
      {
        ...withDeterministicRuntimeDeps(),
        createAdapters: () => [
          createAdapter('pi', {
            '/tmp/pi-1.jsonl': [createEvent({ source: 'pi', sessionId: 'pi-session' })],
          }),
          createAdapter('codex', {
            '/tmp/codex-1.jsonl': [
              createEvent({ source: 'codex', sessionId: 'codex-session', model: undefined }),
            ],
          }),
        ],
      },
    );

    expect(result.diagnostics.sessionStats).toEqual([
      {
        source: 'codex',
        filesFound: 1,
        eventsParsed: 1,
      },
    ]);

    const sourceRows = result.rows.filter((row) => row.rowType === 'period_source');
    expect(sourceRows).toHaveLength(1);
    expect(sourceRows[0].source).toBe('codex');
    expect(result.rows.some((row) => row.rowType === 'period_combined')).toBe(false);
  });

  it('defaults provider filtering to openai when no provider filter is passed', async () => {
    const result = await buildUsageData(
      'daily',
      {
        timezone: 'UTC',
      },
      {
        ...withDeterministicRuntimeDeps(),
        createAdapters: () => [
          createAdapter('pi', {
            '/tmp/pi-1.jsonl': [
              createEvent({ source: 'pi', sessionId: 'pi-session', provider: 'anthropic' }),
            ],
          }),
          createAdapter('codex', {
            '/tmp/codex-1.jsonl': [
              createEvent({ source: 'codex', sessionId: 'codex-session', provider: 'openai' }),
            ],
          }),
        ],
      },
    );

    const sourceRows = result.rows.filter((row) => row.rowType === 'period_source');

    expect(sourceRows).toHaveLength(1);
    expect(sourceRows[0].source).toBe('codex');
  });

  it.each(['cache', 'network', 'fallback', 'offline-cache'] as const)(
    'records pricing origin "%s" when pricing lookup is required',
    async (origin) => {
      const pricingLoaderSpy = vi.fn(
        async (): Promise<PricingLoadResult> => ({
          source: createDefaultOpenAiPricingSource(),
          origin,
        }),
      );

      const result = await buildUsageData(
        'daily',
        {
          timezone: 'UTC',
        },
        {
          ...withDeterministicRuntimeDeps(),
          createAdapters: () => [
            createAdapter('pi', {
              '/tmp/pi-1.jsonl': [
                createEvent({
                  source: 'pi',
                  costMode: 'estimated',
                  costUsd: undefined,
                }),
              ],
            }),
          ],
          resolvePricingSource: pricingLoaderSpy,
        },
      );

      expect(pricingLoaderSpy).toHaveBeenCalledTimes(1);
      expect(result.diagnostics.pricingOrigin).toBe(origin);
    },
  );

  it('keeps pricing origin as none when all events already have explicit cost', async () => {
    const pricingLoaderSpy = vi.fn(
      async (): Promise<PricingLoadResult> => ({
        source: createDefaultOpenAiPricingSource(),
        origin: 'network',
      }),
    );

    const result = await buildUsageData(
      'daily',
      {
        timezone: 'UTC',
      },
      {
        ...withDeterministicRuntimeDeps(),
        createAdapters: () => [
          createAdapter('pi', {
            '/tmp/pi-1.jsonl': [
              createEvent({
                source: 'pi',
                costMode: 'explicit',
                costUsd: 0.12,
              }),
            ],
          }),
        ],
        resolvePricingSource: pricingLoaderSpy,
      },
    );

    expect(pricingLoaderSpy).not.toHaveBeenCalled();
    expect(result.diagnostics.pricingOrigin).toBe('none');
  });

  it('falls back to bundled pricing when LiteLLM network and cache are unavailable', async () => {
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), 'usage-pricing-fallback-'));
    tempDirs.push(cacheRoot);
    process.env.XDG_CACHE_HOME = cacheRoot;

    const fetchSpy = vi.fn(async () => {
      throw new Error('network unavailable');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await buildUsageData(
      'daily',
      {
        timezone: 'UTC',
      },
      {
        ...withDeterministicRuntimeDeps(),
        createAdapters: () => [
          createAdapter('pi', {
            '/tmp/pi-1.jsonl': [
              createEvent({
                source: 'pi',
                costMode: 'estimated',
                costUsd: undefined,
                model: 'gpt-4.1',
              }),
            ],
          }),
        ],
      },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.pricingOrigin).toBe('fallback');
    expect(result.rows[0]?.costUsd).toBeGreaterThan(0);
  });

  it('fails pricing-offline mode when cache is unavailable', async () => {
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), 'usage-pricing-offline-no-cache-'));
    tempDirs.push(cacheRoot);
    process.env.XDG_CACHE_HOME = cacheRoot;

    const fetchSpy = vi.fn(async () => {
      throw new Error('network should not be called in offline mode');
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      buildUsageData(
        'daily',
        {
          timezone: 'UTC',
          pricingOffline: true,
        },
        {
          ...withDeterministicRuntimeDeps(),
          createAdapters: () => [
            createAdapter('pi', {
              '/tmp/pi-1.jsonl': [
                createEvent({
                  source: 'pi',
                  costMode: 'estimated',
                  costUsd: undefined,
                }),
              ],
            }),
          ],
        },
      ),
    ).rejects.toThrow('Offline pricing mode enabled but cached pricing is unavailable');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
