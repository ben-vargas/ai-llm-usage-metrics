import { describe, expect, it } from 'vitest';

import { aggregateUsage } from '../../src/aggregate/aggregate-usage.js';
import { createUsageEvent } from '../../src/domain/usage-event.js';

describe('aggregateUsage', () => {
  it('produces source rows, period combined rows, and grand totals', () => {
    const events = [
      createUsageEvent({
        source: 'pi',
        sessionId: 's1',
        timestamp: '2026-02-10T10:00:00Z',
        model: 'gpt-4.1',
        inputTokens: 10,
        outputTokens: 5,
        reasoningTokens: 1,
        totalTokens: 16,
        costUsd: 1,
        costMode: 'explicit',
      }),
      createUsageEvent({
        source: 'codex',
        sessionId: 's2',
        timestamp: '2026-02-10T13:00:00Z',
        model: 'gpt-5-codex',
        inputTokens: 20,
        outputTokens: 10,
        reasoningTokens: 2,
        cacheReadTokens: 5,
        totalTokens: 37,
        costUsd: 0.5,
        costMode: 'estimated',
      }),
      createUsageEvent({
        source: 'pi',
        sessionId: 's3',
        timestamp: '2026-02-11T09:00:00Z',
        model: 'gpt-4.1',
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
      }),
    ];

    const rows = aggregateUsage(events, { granularity: 'daily', timezone: 'UTC' });

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      rowType: 'period_source',
      periodKey: '2026-02-10',
      source: 'pi',
      totalTokens: 16,
      costUsd: 1,
      models: ['gpt-4.1'],
    });
    expect(rows[1]).toMatchObject({
      rowType: 'period_source',
      periodKey: '2026-02-10',
      source: 'codex',
      totalTokens: 37,
      costUsd: 0.5,
      models: ['gpt-5-codex'],
    });
    expect(rows[2]).toMatchObject({
      rowType: 'period_combined',
      periodKey: '2026-02-10',
      source: 'combined',
      totalTokens: 53,
      costUsd: 1.5,
      models: ['gpt-4.1', 'gpt-5-codex'],
    });

    expect(rows[3]).toMatchObject({
      rowType: 'period_source',
      periodKey: '2026-02-11',
      source: 'pi',
      totalTokens: 5,
      costUsd: 0,
    });
    expect(rows[4]).toMatchObject({
      rowType: 'grand_total',
      periodKey: 'ALL',
      totalTokens: 58,
      costUsd: 1.5,
    });
  });

  it('splits weeks at Monday boundary', () => {
    const events = [
      createUsageEvent({
        source: 'pi',
        sessionId: 'week-1',
        timestamp: '2026-01-04T12:00:00Z',
        model: 'gpt-4.1',
        inputTokens: 1,
        outputTokens: 1,
      }),
      createUsageEvent({
        source: 'pi',
        sessionId: 'week-2',
        timestamp: '2026-01-05T12:00:00Z',
        model: 'gpt-4.1',
        inputTokens: 2,
        outputTokens: 2,
      }),
    ];

    const rows = aggregateUsage(events, { granularity: 'weekly', timezone: 'UTC' });

    expect(rows[0]).toMatchObject({
      periodKey: '2026-W01',
      rowType: 'period_source',
      totalTokens: 2,
    });
    expect(rows[1]).toMatchObject({
      periodKey: '2026-W02',
      rowType: 'period_source',
      totalTokens: 4,
    });
    expect(rows[2]).toMatchObject({ rowType: 'grand_total', totalTokens: 6 });
  });
});
