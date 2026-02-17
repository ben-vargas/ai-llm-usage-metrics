import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ModelPricing, PricingSource } from './types.js';

const ONE_MILLION = 1_000_000;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 4000;

export const DEFAULT_LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

type LiteLLMCachePayload = {
  fetchedAt: number;
  sourceUrl: string;
  pricingByModel: Record<string, ModelPricing>;
};

export type LiteLLMPricingFetcherOptions = {
  sourceUrl?: string;
  cacheFilePath?: string;
  cacheTtlMs?: number;
  fetchTimeoutMs?: number;
  offline?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function normalizeModelPricing(rawModelPricing: Record<string, unknown>): ModelPricing | undefined {
  const inputPerToken = toNonNegativeNumber(rawModelPricing.input_cost_per_token);
  const outputPerToken = toNonNegativeNumber(rawModelPricing.output_cost_per_token);

  if (inputPerToken === undefined || outputPerToken === undefined) {
    return undefined;
  }

  const cacheReadPerToken = toNonNegativeNumber(rawModelPricing.cache_read_input_token_cost);
  const cacheWritePerToken = toNonNegativeNumber(rawModelPricing.cache_creation_input_token_cost);

  const modelPricing: ModelPricing = {
    inputPer1MUsd: inputPerToken * ONE_MILLION,
    outputPer1MUsd: outputPerToken * ONE_MILLION,
  };

  if (cacheReadPerToken !== undefined) {
    modelPricing.cacheReadPer1MUsd = cacheReadPerToken * ONE_MILLION;
  }

  if (cacheWritePerToken !== undefined) {
    modelPricing.cacheWritePer1MUsd = cacheWritePerToken * ONE_MILLION;
  }

  return modelPricing;
}

function normalizeLitellmPricingPayload(payload: unknown): Map<string, ModelPricing> {
  const payloadRecord = asRecord(payload);

  if (!payloadRecord) {
    throw new Error('LiteLLM pricing payload must be a JSON object');
  }

  const normalizedPricing = new Map<string, ModelPricing>();

  for (const [modelName, rawModelPricing] of Object.entries(payloadRecord)) {
    const modelPricingRecord = asRecord(rawModelPricing);

    if (!modelPricingRecord) {
      continue;
    }

    const normalizedModelPricing = normalizeModelPricing(modelPricingRecord);

    if (!normalizedModelPricing) {
      continue;
    }

    normalizedPricing.set(normalizeKey(modelName), normalizedModelPricing);
  }

  if (normalizedPricing.size === 0) {
    throw new Error('LiteLLM pricing payload did not contain any usable model pricing entries');
  }

  return normalizedPricing;
}

function getCacheRootDir(): string {
  const xdgCacheDir = process.env.XDG_CACHE_HOME;

  if (xdgCacheDir) {
    return xdgCacheDir;
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;

    if (localAppData) {
      return localAppData;
    }
  }

  return path.join(os.homedir(), '.cache');
}

export function getDefaultLiteLLMPricingCachePath(): string {
  return path.join(getCacheRootDir(), 'llm-usage-metrics', 'litellm-pricing-cache.json');
}

function stripProviderPrefix(model: string): string {
  const slashIndex = model.lastIndexOf('/');

  if (slashIndex === -1) {
    return model;
  }

  return model.slice(slashIndex + 1);
}

function canonicalizeForFuzzy(value: string): string {
  return value.replace(/[^a-z0-9]/gu, '');
}

function levenshteinDistance(left: string, right: string): number {
  const leftLength = left.length;
  const rightLength = right.length;

  const matrix = Array.from({ length: leftLength + 1 }, (_, rowIndex) => {
    return Array.from({ length: rightLength + 1 }, (_, columnIndex) => {
      if (rowIndex === 0) {
        return columnIndex;
      }

      if (columnIndex === 0) {
        return rowIndex;
      }

      return 0;
    });
  });

  for (let rowIndex = 1; rowIndex <= leftLength; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= rightLength; columnIndex += 1) {
      const substitutionCost = left[rowIndex - 1] === right[columnIndex - 1] ? 0 : 1;

      matrix[rowIndex][columnIndex] = Math.min(
        matrix[rowIndex - 1][columnIndex] + 1,
        matrix[rowIndex][columnIndex - 1] + 1,
        matrix[rowIndex - 1][columnIndex - 1] + substitutionCost,
      );
    }
  }

  return matrix[leftLength][rightLength];
}

export class LiteLLMPricingFetcher implements PricingSource {
  private readonly sourceUrl: string;
  private readonly cacheFilePath: string;
  private readonly cacheTtlMs: number;
  private readonly fetchTimeoutMs: number;
  private readonly offline: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  private pricingByModel = new Map<string, ModelPricing>();

  public constructor(options: LiteLLMPricingFetcherOptions = {}) {
    this.sourceUrl = options.sourceUrl ?? DEFAULT_LITELLM_PRICING_URL;
    this.cacheFilePath = options.cacheFilePath ?? getDefaultLiteLLMPricingCachePath();
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    this.offline = options.offline ?? false;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  public async load(): Promise<void> {
    const cacheLoaded = await this.loadFromCache({ allowStale: false });

    if (cacheLoaded) {
      return;
    }

    if (this.offline) {
      const staleCacheLoaded = await this.loadFromCache({ allowStale: true });

      if (!staleCacheLoaded) {
        throw new Error('Offline pricing mode enabled but no cached LiteLLM pricing is available');
      }

      return;
    }

    try {
      await this.loadFromRemote();
    } catch {
      const staleCacheLoaded = await this.loadFromCache({ allowStale: true });

      if (!staleCacheLoaded) {
        throw new Error('Could not load LiteLLM pricing from network or cache');
      }
    }
  }

  public resolveModelAlias(model: string): string {
    const normalizedModel = normalizeKey(model);
    const directMatch = this.resolveDirectModelMatch(normalizedModel);

    if (directMatch) {
      return directMatch;
    }

    const prefixMatch = this.resolvePrefixModelMatch(normalizedModel);

    if (prefixMatch) {
      return prefixMatch;
    }

    const fuzzyMatch = this.resolveFuzzyModelMatch(normalizedModel);

    return fuzzyMatch ?? normalizedModel;
  }

  public getPricing(model: string): ModelPricing | undefined {
    const resolvedModel = this.resolveModelAlias(model);
    return this.pricingByModel.get(resolvedModel);
  }

  private resolveDirectModelMatch(normalizedModel: string): string | undefined {
    if (this.pricingByModel.has(normalizedModel)) {
      return normalizedModel;
    }

    const strippedModel = stripProviderPrefix(normalizedModel);

    if (this.pricingByModel.has(strippedModel)) {
      return strippedModel;
    }

    return undefined;
  }

  private resolvePrefixModelMatch(normalizedModel: string): string | undefined {
    const candidates = [normalizedModel, stripProviderPrefix(normalizedModel)];
    const modelNames = [...this.pricingByModel.keys()];

    for (const candidate of candidates) {
      const prefixMatches = modelNames.filter((modelName) => {
        return candidate.startsWith(modelName) || modelName.startsWith(candidate);
      });

      if (prefixMatches.length > 0) {
        return prefixMatches.sort(
          (left, right) => right.length - left.length || left.localeCompare(right),
        )[0];
      }
    }

    return undefined;
  }

  private resolveFuzzyModelMatch(normalizedModel: string): string | undefined {
    const fuzzyTarget = canonicalizeForFuzzy(stripProviderPrefix(normalizedModel));

    if (!fuzzyTarget) {
      return undefined;
    }

    let bestMatch: { modelName: string; distance: number } | undefined;

    for (const modelName of this.pricingByModel.keys()) {
      const fuzzyModelName = canonicalizeForFuzzy(modelName);

      if (!fuzzyModelName) {
        continue;
      }

      const distance = levenshteinDistance(fuzzyTarget, fuzzyModelName);

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { modelName, distance };
      }
    }

    if (!bestMatch) {
      return undefined;
    }

    const maxDistance = Math.max(2, Math.floor(fuzzyTarget.length * 0.2));

    if (bestMatch.distance > maxDistance) {
      return undefined;
    }

    return bestMatch.modelName;
  }

  private async loadFromRemote(): Promise<void> {
    const response = await this.fetchImpl(this.sourceUrl, {
      signal: AbortSignal.timeout(this.fetchTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch LiteLLM pricing: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const normalizedPricing = normalizeLitellmPricingPayload(payload);

    this.pricingByModel = normalizedPricing;
    await this.writeCache();
  }

  private async loadFromCache(options: { allowStale: boolean }): Promise<boolean> {
    const cacheFileContent = await this.readCachePayload();

    if (!cacheFileContent) {
      return false;
    }

    const isStale = this.now() - cacheFileContent.fetchedAt > this.cacheTtlMs;

    if (isStale && !options.allowStale) {
      return false;
    }

    this.pricingByModel = new Map(
      Object.entries(cacheFileContent.pricingByModel).map(([modelName, pricing]) => [
        normalizeKey(modelName),
        pricing,
      ]),
    );

    return this.pricingByModel.size > 0;
  }

  private normalizeCachedPricing(rawPricing: unknown): ModelPricing | undefined {
    const pricingRecord = asRecord(rawPricing);

    if (!pricingRecord) {
      return undefined;
    }

    const inputPer1MUsd = toNonNegativeNumber(pricingRecord.inputPer1MUsd);
    const outputPer1MUsd = toNonNegativeNumber(pricingRecord.outputPer1MUsd);

    if (inputPer1MUsd === undefined || outputPer1MUsd === undefined) {
      return undefined;
    }

    const modelPricing: ModelPricing = {
      inputPer1MUsd,
      outputPer1MUsd,
    };

    const cacheReadPer1MUsd = toNonNegativeNumber(pricingRecord.cacheReadPer1MUsd);

    if (cacheReadPer1MUsd !== undefined) {
      modelPricing.cacheReadPer1MUsd = cacheReadPer1MUsd;
    }

    const cacheWritePer1MUsd = toNonNegativeNumber(pricingRecord.cacheWritePer1MUsd);

    if (cacheWritePer1MUsd !== undefined) {
      modelPricing.cacheWritePer1MUsd = cacheWritePer1MUsd;
    }

    return modelPricing;
  }

  private async readCachePayload(): Promise<LiteLLMCachePayload | undefined> {
    let content: string;

    try {
      content = await readFile(this.cacheFilePath, 'utf8');
    } catch {
      return undefined;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(content);
    } catch {
      return undefined;
    }

    const payloadRecord = asRecord(parsedPayload);

    if (!payloadRecord) {
      return undefined;
    }

    const fetchedAt = toNonNegativeNumber(payloadRecord.fetchedAt);
    const sourceUrl =
      typeof payloadRecord.sourceUrl === 'string' ? payloadRecord.sourceUrl : undefined;
    const pricingByModelRecord = asRecord(payloadRecord.pricingByModel);

    if (fetchedAt === undefined || !sourceUrl || !pricingByModelRecord) {
      return undefined;
    }

    const pricingByModel: Record<string, ModelPricing> = {};

    for (const [modelName, rawPricing] of Object.entries(pricingByModelRecord)) {
      const pricing = this.normalizeCachedPricing(rawPricing);

      if (!pricing) {
        continue;
      }

      pricingByModel[modelName] = pricing;
    }

    return {
      fetchedAt,
      sourceUrl,
      pricingByModel,
    };
  }

  private async writeCache(): Promise<void> {
    const directoryPath = path.dirname(this.cacheFilePath);
    await mkdir(directoryPath, { recursive: true });

    const payload: LiteLLMCachePayload = {
      fetchedAt: this.now(),
      sourceUrl: this.sourceUrl,
      pricingByModel: Object.fromEntries(this.pricingByModel.entries()),
    };

    await writeFile(this.cacheFilePath, JSON.stringify(payload), 'utf8');
  }
}
