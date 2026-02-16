import { describe, expect, it } from 'vitest';

import { createUsageEvent } from '../../src/domain/usage-event.js';

describe('createUsageEvent', () => {
  it('normalizes counters and infers total from components when needed', () => {
    const event = createUsageEvent({
      source: 'pi',
      sessionId: 'session-1',
      timestamp: '2026-02-12T10:00:00Z',
      inputTokens: 10,
      outputTokens: '25',
      reasoningTokens: 5.9,
      cacheReadTokens: -1,
      cacheWriteTokens: undefined,
      totalTokens: 20,
      costUsd: '0.15',
    });

    expect(event).toMatchObject({
      source: 'pi',
      sessionId: 'session-1',
      inputTokens: 10,
      outputTokens: 25,
      reasoningTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 40,
      costUsd: 0.15,
      costMode: 'explicit',
    });
  });

  it('defaults to estimated mode when cost is missing', () => {
    const event = createUsageEvent({
      source: 'codex',
      sessionId: 'session-2',
      timestamp: '2026-02-12T10:00:00Z',
      inputTokens: 1,
      outputTokens: 2,
    });

    expect(event.costMode).toBe('estimated');
    expect(event.costUsd).toBeUndefined();
  });

  it('throws when explicit costMode has no cost', () => {
    expect(() =>
      createUsageEvent({
        source: 'pi',
        sessionId: 'session-3',
        timestamp: '2026-02-12T10:00:00Z',
        costMode: 'explicit',
      }),
    ).toThrow('requires costUsd');
  });

  it('throws on empty source or session id', () => {
    expect(() =>
      createUsageEvent({
        source: ' ',
        sessionId: 'session-4',
        timestamp: '2026-02-12T10:00:00Z',
      }),
    ).toThrow('source');

    expect(() =>
      createUsageEvent({
        source: 'pi',
        sessionId: ' ',
        timestamp: '2026-02-12T10:00:00Z',
      }),
    ).toThrow('sessionId');
  });
});
