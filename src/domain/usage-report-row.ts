import type { SourceId } from './usage-event.js';

export type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type PeriodSourceRow = UsageTotals & {
  rowType: 'period_source';
  periodKey: string;
  source: SourceId;
  models: string[];
};

export type PeriodCombinedRow = UsageTotals & {
  rowType: 'period_combined';
  periodKey: string;
  source: 'combined';
  models: string[];
};

export type GrandTotalRow = UsageTotals & {
  rowType: 'grand_total';
  periodKey: 'ALL';
  source: 'combined';
  models: string[];
};

export type UsageReportRow = PeriodSourceRow | PeriodCombinedRow | GrandTotalRow;
