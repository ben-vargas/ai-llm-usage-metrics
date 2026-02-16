export type ReasoningBillingMode = 'included-in-output' | 'separate';

export type ModelPricing = {
  inputPer1MUsd: number;
  outputPer1MUsd: number;
  cacheReadPer1MUsd?: number;
  cacheWritePer1MUsd?: number;
  reasoningPer1MUsd?: number;
  reasoningBilling?: ReasoningBillingMode;
};

export interface PricingSource {
  resolveModelAlias(model: string): string;
  getPricing(model: string): ModelPricing | undefined;
}
