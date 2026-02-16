import type { UsageReportRow } from '../domain/usage-report-row.js';

export const usageTableHeaders = [
  'Period',
  'Source',
  'Models',
  'Input',
  'Output',
  'Reasoning',
  'Cache Read',
  'Cache Write',
  'Total Tokens',
  'Cost (USD)',
] as const;

const integerFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

function formatSource(row: UsageReportRow): string {
  if (row.rowType === 'grand_total') {
    return 'TOTAL';
  }

  return row.source;
}

function formatModels(models: string[]): string {
  return models.length > 0 ? models.join(', ') : '-';
}

function formatTokenCount(value: number): string {
  return integerFormatter.format(value);
}

function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

export function toUsageTableCells(rows: UsageReportRow[]): string[][] {
  return rows.map((row) => [
    row.periodKey,
    formatSource(row),
    formatModels(row.models),
    formatTokenCount(row.inputTokens),
    formatTokenCount(row.outputTokens),
    formatTokenCount(row.reasoningTokens),
    formatTokenCount(row.cacheReadTokens),
    formatTokenCount(row.cacheWriteTokens),
    formatTokenCount(row.totalTokens),
    formatUsd(row.costUsd),
  ]);
}
