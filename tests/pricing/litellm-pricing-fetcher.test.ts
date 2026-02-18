import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LiteLLMPricingFetcher,
  type LiteLLMPricingFetcherOptions,
} from '../../src/pricing/litellm-pricing-fetcher.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

function createFetcher(options: LiteLLMPricingFetcherOptions = {}): LiteLLMPricingFetcher {
  return new LiteLLMPricingFetcher({
    sourceUrl: 'https://example.test/litellm-pricing.json',
    ...options,
  });
}

describe('LiteLLMPricingFetcher', () => {
  it('downloads, validates and resolves models via prefix and fuzzy lookup', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'litellm-pricing-'));
    tempDirs.push(rootDir);

    const fetcher = createFetcher({
      cacheFilePath: path.join(rootDir, 'cache.json'),
      fetchImpl: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            'gpt-5.2-codex': {
              input_cost_per_token: 0.0000015,
              output_cost_per_token: 0.00001,
              cache_read_input_token_cost: 0.00000015,
              output_cost_per_reasoning_token: 0.00002,
            },
            'gpt-5.2': {
              input_cost_per_token: 0.00000125,
              output_cost_per_token: 0.00001,
            },
            'gpt-4.1': {
              input_cost_per_token: 0.000002,
              output_cost_per_token: 0.000008,
            },
            'not-a-valid-entry': {
              model: 'broken',
            },
          }),
          { status: 200 },
        );
      }),
    });

    await fetcher.load();

    const codexPrefixPricing = fetcher.getPricing('openai/gpt-5.2-codex-2026-01-01');
    const genericPrefixPricing = fetcher.getPricing('gpt-5.2-2026-01-01');
    const fuzzyPricing = fetcher.getPricing('gpt52codex');

    expect(codexPrefixPricing).toBeDefined();
    expect(codexPrefixPricing?.inputPer1MUsd).toBeCloseTo(1.5, 10);
    expect(codexPrefixPricing?.cacheReadPer1MUsd).toBeCloseTo(0.15, 10);
    expect(codexPrefixPricing?.reasoningPer1MUsd).toBeCloseTo(20, 10);
    expect(codexPrefixPricing?.reasoningBilling).toBe('separate');

    expect(genericPrefixPricing).toBeDefined();
    expect(genericPrefixPricing?.inputPer1MUsd).toBeCloseTo(1.25, 10);
    expect(fuzzyPricing).toBeDefined();
    expect(fuzzyPricing?.outputPer1MUsd).toBeCloseTo(10, 10);
  });

  it('ignores pricing entries with blank numeric string values', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'litellm-pricing-blank-values-'));
    tempDirs.push(rootDir);

    const fetcher = createFetcher({
      cacheFilePath: path.join(rootDir, 'cache.json'),
      fetchImpl: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            'broken-model': {
              input_cost_per_token: '   ',
              output_cost_per_token: 0.00001,
            },
            'gpt-5.2-codex': {
              input_cost_per_token: 0.0000015,
              output_cost_per_token: 0.00001,
            },
          }),
          { status: 200 },
        );
      }),
    });

    await fetcher.load();

    expect(fetcher.getPricing('broken-model')).toBeUndefined();
    expect(fetcher.getPricing('gpt-5.2-codex')).toBeDefined();
  });

  it('treats future cache timestamps as stale and refreshes from remote', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'litellm-pricing-future-cache-'));
    tempDirs.push(rootDir);

    const cacheFilePath = path.join(rootDir, 'cache.json');
    const nowValue = 1_000_000;

    await writeFile(
      cacheFilePath,
      JSON.stringify({
        fetchedAt: nowValue + 60_000,
        sourceUrl: 'https://example.test/litellm-pricing.json',
        pricingByModel: {
          'gpt-5.2-codex': {
            inputPer1MUsd: 1,
            outputPer1MUsd: 2,
          },
        },
      }),
      'utf8',
    );

    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          'gpt-5.2-codex': {
            input_cost_per_token: 0.000003,
            output_cost_per_token: 0.00001,
          },
        }),
        { status: 200 },
      );
    });

    const fetcher = createFetcher({
      cacheFilePath,
      cacheTtlMs: 24 * 60 * 60 * 1000,
      now: () => nowValue,
      fetchImpl: fetchSpy,
    });

    await fetcher.load();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetcher.getPricing('gpt-5.2-codex')?.inputPer1MUsd).toBeCloseTo(3, 10);
  });

  it('uses cached pricing in offline mode', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'litellm-pricing-offline-'));
    tempDirs.push(rootDir);

    const cacheFilePath = path.join(rootDir, 'cache.json');

    const onlineFetcher = createFetcher({
      cacheFilePath,
      fetchImpl: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            'gpt-5.2-codex': {
              input_cost_per_token: 0.0000015,
              output_cost_per_token: 0.00001,
            },
          }),
          { status: 200 },
        );
      }),
    });

    await onlineFetcher.load();

    const offlineFetcher = createFetcher({
      cacheFilePath,
      offline: true,
      cacheTtlMs: 1,
      now: () => Date.now() + 10_000,
      fetchImpl: vi.fn(async () => {
        throw new Error('Offline fetch should not be called');
      }),
    });

    await offlineFetcher.load();

    expect(offlineFetcher.getPricing('gpt-5.2-codex')).toBeDefined();
  });

  it('does not reuse cache when source URL differs', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'litellm-pricing-source-url-'));
    tempDirs.push(rootDir);

    const cacheFilePath = path.join(rootDir, 'cache.json');

    const onlineFetcher = createFetcher({
      cacheFilePath,
      sourceUrl: 'https://example.test/pricing-A.json',
      fetchImpl: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            'gpt-5.2-codex': {
              input_cost_per_token: 0.0000015,
              output_cost_per_token: 0.00001,
            },
          }),
          { status: 200 },
        );
      }),
    });

    await onlineFetcher.load();

    const offlineFetcherWithDifferentSource = createFetcher({
      cacheFilePath,
      sourceUrl: 'https://example.test/pricing-B.json',
      offline: true,
    });

    await expect(offlineFetcherWithDifferentSource.load()).rejects.toThrow(
      'Offline pricing mode enabled',
    );
  });

  it('keeps remote pricing when cache write fails', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'litellm-pricing-cache-write-fail-'));
    tempDirs.push(rootDir);

    const blockingPath = path.join(rootDir, 'not-a-directory');
    await rm(blockingPath, { force: true });
    await writeFile(blockingPath, 'blocked', 'utf8');

    const fetcher = createFetcher({
      cacheFilePath: path.join(blockingPath, 'cache.json'),
      fetchImpl: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            'gpt-5.2-codex': {
              input_cost_per_token: 0.0000015,
              output_cost_per_token: 0.00001,
            },
          }),
          { status: 200 },
        );
      }),
    });

    const fromCache = await fetcher.load();
    expect(fromCache).toBe(false);
    expect(fetcher.getPricing('gpt-5.2-codex')).toBeDefined();
  });

  it('throws in offline mode when cache is unavailable', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'litellm-pricing-missing-cache-'));
    tempDirs.push(rootDir);

    const fetcher = createFetcher({
      cacheFilePath: path.join(rootDir, 'cache.json'),
      offline: true,
    });

    await expect(fetcher.load()).rejects.toThrow('Offline pricing mode enabled');
  });
});
