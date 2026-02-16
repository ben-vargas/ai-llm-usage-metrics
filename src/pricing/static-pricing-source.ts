import type { ModelPricing, PricingSource } from './types.js';

export type StaticPricingSourceOptions = {
  pricingByModel: Record<string, ModelPricing>;
  modelAliases?: Record<string, string>;
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export class StaticPricingSource implements PricingSource {
  private readonly pricingByModel: Map<string, ModelPricing>;
  private readonly modelAliases: Map<string, string>;

  public constructor(options: StaticPricingSourceOptions) {
    this.pricingByModel = new Map(
      Object.entries(options.pricingByModel).map(([model, pricing]) => [
        normalizeKey(model),
        pricing,
      ]),
    );
    this.modelAliases = new Map(
      Object.entries(options.modelAliases ?? {}).map(([alias, target]) => [
        normalizeKey(alias),
        normalizeKey(target),
      ]),
    );
  }

  public resolveModelAlias(model: string): string {
    const normalizedModel = normalizeKey(model);
    return this.modelAliases.get(normalizedModel) ?? normalizedModel;
  }

  public getPricing(model: string): ModelPricing | undefined {
    const resolvedModel = this.resolveModelAlias(model);
    return this.pricingByModel.get(resolvedModel);
  }
}

export function createDefaultOpenAiPricingSource(): StaticPricingSource {
  return new StaticPricingSource({
    pricingByModel: {
      'gpt-5-codex': {
        inputPer1MUsd: 1.5,
        outputPer1MUsd: 10,
        cacheReadPer1MUsd: 0.15,
      },
      'gpt-4.1': {
        inputPer1MUsd: 2,
        outputPer1MUsd: 8,
        cacheReadPer1MUsd: 0.5,
      },
    },
    modelAliases: {
      'gpt-5.1-codex': 'gpt-5-codex',
      'gpt-5.2-codex': 'gpt-5-codex',
      'gpt-5.3-codex': 'gpt-5-codex',
    },
  });
}
