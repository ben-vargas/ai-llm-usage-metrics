import { describe, expect, it } from 'vitest';

import { createUsageEvent } from '../../src/domain/usage-event.js';
import {
  applyPricingToEvent,
  applyPricingToEvents,
  calculateEstimatedCostUsd,
} from '../../src/pricing/cost-engine.js';
import { StaticPricingSource } from '../../src/pricing/static-pricing-source.js';

describe('cost engine', () => {
  it('keeps explicit costs unchanged', () => {
    const source = new StaticPricingSource({
      pricingByModel: {
        'gpt-5-codex': { inputPer1MUsd: 1, outputPer1MUsd: 2 },
      },
    });

    const explicitEvent = createUsageEvent({
      source: 'pi',
      sessionId: 'session-1',
      timestamp: '2026-02-16T10:00:00Z',
      model: 'gpt-5-codex',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 1.23,
      costMode: 'explicit',
    });

    const pricedEvent = applyPricingToEvent(explicitEvent, source);

    expect(pricedEvent.costMode).toBe('explicit');
    expect(pricedEvent.costUsd).toBe(1.23);
  });

  it('estimates cost using alias mapping without double charging reasoning by default', () => {
    const source = new StaticPricingSource({
      pricingByModel: {
        'gpt-5-codex': {
          inputPer1MUsd: 1,
          outputPer1MUsd: 2,
          cacheReadPer1MUsd: 0.5,
          cacheWritePer1MUsd: 1,
        },
      },
      modelAliases: {
        'gpt-5.3-codex': 'gpt-5-codex',
      },
    });

    const event = createUsageEvent({
      source: 'codex',
      sessionId: 'session-2',
      timestamp: '2026-02-16T10:00:00Z',
      model: 'gpt-5.3-codex',
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: 300,
      cacheReadTokens: 200,
      cacheWriteTokens: 50,
      costMode: 'estimated',
    });

    const pricedEvent = applyPricingToEvent(event, source);

    expect(pricedEvent.costMode).toBe('estimated');
    expect(pricedEvent.costUsd).toBeCloseTo(0.00215, 10);
  });

  it('can charge reasoning tokens separately when configured', () => {
    const event = createUsageEvent({
      source: 'codex',
      sessionId: 'session-3',
      timestamp: '2026-02-16T10:00:00Z',
      model: 'gpt-5-codex',
      inputTokens: 0,
      outputTokens: 100,
      reasoningTokens: 50,
      costMode: 'estimated',
    });

    const estimated = calculateEstimatedCostUsd(event, {
      inputPer1MUsd: 0,
      outputPer1MUsd: 2,
      reasoningPer1MUsd: 3,
      reasoningBilling: 'separate',
    });

    expect(estimated).toBeCloseTo(0.00035, 10);
  });

  it('keeps estimated mode with undefined cost when no pricing exists', () => {
    const source = new StaticPricingSource({
      pricingByModel: {
        'gpt-4.1': {
          inputPer1MUsd: 1,
          outputPer1MUsd: 2,
        },
      },
    });

    const event = createUsageEvent({
      source: 'codex',
      sessionId: 'session-4',
      timestamp: '2026-02-16T10:00:00Z',
      model: 'unknown-model',
      inputTokens: 10,
      outputTokens: 20,
      costMode: 'estimated',
    });

    const pricedEvent = applyPricingToEvents([event], source)[0];

    expect(pricedEvent?.costMode).toBe('estimated');
    expect(pricedEvent?.costUsd).toBeUndefined();
  });
});
