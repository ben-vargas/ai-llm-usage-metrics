import type { UsageEvent } from '../domain/usage-event.js';
import type { ModelPricing, PricingSource } from './types.js';

const ONE_MILLION = 1_000_000;

function estimateTokenGroupCost(tokens: number, per1MUsd: number | undefined): number {
  if (!per1MUsd || tokens <= 0) {
    return 0;
  }

  return (tokens / ONE_MILLION) * per1MUsd;
}

export function calculateEstimatedCostUsd(event: UsageEvent, pricing: ModelPricing): number {
  const reasoningBilling = pricing.reasoningBilling ?? 'included-in-output';

  const inputCost = estimateTokenGroupCost(event.inputTokens, pricing.inputPer1MUsd);
  const outputCost = estimateTokenGroupCost(event.outputTokens, pricing.outputPer1MUsd);
  const cacheReadCost = estimateTokenGroupCost(event.cacheReadTokens, pricing.cacheReadPer1MUsd);
  const cacheWriteCost = estimateTokenGroupCost(event.cacheWriteTokens, pricing.cacheWritePer1MUsd);

  const reasoningCost =
    reasoningBilling === 'separate'
      ? estimateTokenGroupCost(event.reasoningTokens, pricing.reasoningPer1MUsd)
      : 0;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost + reasoningCost;
}

export function applyPricingToEvent(event: UsageEvent, pricingSource: PricingSource): UsageEvent {
  if (event.costMode === 'explicit' && event.costUsd !== undefined) {
    return event;
  }

  if (!event.model) {
    return { ...event, costMode: 'estimated' };
  }

  const pricing = pricingSource.getPricing(event.model);

  if (!pricing) {
    return { ...event, costMode: 'estimated' };
  }

  return {
    ...event,
    costUsd: calculateEstimatedCostUsd(event, pricing),
    costMode: 'estimated',
  };
}

export function applyPricingToEvents(
  events: UsageEvent[],
  pricingSource: PricingSource,
): UsageEvent[] {
  return events.map((event) => applyPricingToEvent(event, pricingSource));
}
