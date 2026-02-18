import type { UsageEvent } from '../domain/usage-event.js';
import type {
  GrandTotalRow,
  PeriodCombinedRow,
  PeriodSourceRow,
  UsageReportRow,
  UsageTotals,
} from '../domain/usage-report-row.js';
import { normalizeModelList } from '../domain/normalization.js';
import { getPeriodKey, type ReportGranularity } from '../utils/time-buckets.js';

export type AggregateUsageOptions = {
  granularity: ReportGranularity;
  timezone: string;
};

type RowAccumulator = {
  totals: UsageTotals;
  modelSet: Set<string>;
};

const USD_PRECISION_SCALE = 1_000_000_000_000;

function addUsd(left: number, right: number): number {
  return Math.round((left + right) * USD_PRECISION_SCALE) / USD_PRECISION_SCALE;
}

function createEmptyTotals(): UsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };
}

function createRowAccumulator(): RowAccumulator {
  return {
    totals: createEmptyTotals(),
    modelSet: new Set<string>(),
  };
}

function addEventToAccumulator(accumulator: RowAccumulator, event: UsageEvent): void {
  accumulator.totals.inputTokens += event.inputTokens;
  accumulator.totals.outputTokens += event.outputTokens;
  accumulator.totals.reasoningTokens += event.reasoningTokens;
  accumulator.totals.cacheReadTokens += event.cacheReadTokens;
  accumulator.totals.cacheWriteTokens += event.cacheWriteTokens;
  accumulator.totals.totalTokens += event.totalTokens;
  accumulator.totals.costUsd = addUsd(accumulator.totals.costUsd, event.costUsd ?? 0);

  if (event.model) {
    accumulator.modelSet.add(event.model);
  }
}

function addTotals(target: UsageTotals, source: UsageTotals): void {
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.reasoningTokens += source.reasoningTokens;
  target.cacheReadTokens += source.cacheReadTokens;
  target.cacheWriteTokens += source.cacheWriteTokens;
  target.totalTokens += source.totalTokens;
  target.costUsd = addUsd(target.costUsd, source.costUsd);
}

function sourceSortComparator(left: string, right: string): number {
  const sourceOrder: Record<string, number> = {
    pi: 0,
    codex: 1,
  };

  const leftWeight = sourceOrder[left] ?? Number.MAX_SAFE_INTEGER;
  const rightWeight = sourceOrder[right] ?? Number.MAX_SAFE_INTEGER;

  if (leftWeight !== rightWeight) {
    return leftWeight - rightWeight;
  }

  return left.localeCompare(right);
}

export function aggregateUsage(
  events: UsageEvent[],
  options: AggregateUsageOptions,
): UsageReportRow[] {
  const periodMap = new Map<string, Map<string, RowAccumulator>>();

  for (const event of events) {
    const periodKey = getPeriodKey(event.timestamp, options.granularity, options.timezone);
    const periodSources = periodMap.get(periodKey) ?? new Map<string, RowAccumulator>();
    periodMap.set(periodKey, periodSources);

    const rowAccumulator = periodSources.get(event.source) ?? createRowAccumulator();
    periodSources.set(event.source, rowAccumulator);

    addEventToAccumulator(rowAccumulator, event);
  }

  const sortedPeriodKeys = [...periodMap.keys()].sort((left, right) => left.localeCompare(right));
  const rows: UsageReportRow[] = [];
  const grandTotals = createEmptyTotals();
  const grandModels = new Set<string>();

  for (const periodKey of sortedPeriodKeys) {
    const sourceMap = periodMap.get(periodKey);

    if (!sourceMap) {
      continue;
    }

    const periodCombinedTotals = createEmptyTotals();
    const periodModels = new Set<string>();

    const sortedSources = [...sourceMap.keys()].sort(sourceSortComparator);

    for (const source of sortedSources) {
      const accumulator = sourceMap.get(source);

      if (!accumulator) {
        continue;
      }

      const sourceRow: PeriodSourceRow = {
        rowType: 'period_source',
        periodKey,
        source,
        models: normalizeModelList(accumulator.modelSet),
        ...accumulator.totals,
      };

      rows.push(sourceRow);

      addTotals(periodCombinedTotals, accumulator.totals);
      addTotals(grandTotals, accumulator.totals);

      for (const model of accumulator.modelSet) {
        periodModels.add(model);
        grandModels.add(model);
      }
    }

    if (sortedSources.length > 1) {
      const combinedRow: PeriodCombinedRow = {
        rowType: 'period_combined',
        periodKey,
        source: 'combined',
        models: normalizeModelList(periodModels),
        ...periodCombinedTotals,
      };

      rows.push(combinedRow);
    }
  }

  const grandTotalRow: GrandTotalRow = {
    rowType: 'grand_total',
    periodKey: 'ALL',
    source: 'combined',
    models: normalizeModelList(grandModels),
    ...grandTotals,
  };

  rows.push(grandTotalRow);

  return rows;
}
