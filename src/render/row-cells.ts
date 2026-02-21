import type { ModelUsageBreakdown, UsageReportRow } from '../domain/usage-report-row.js';

export type UsageTableLayout = 'compact' | 'per_model_columns';

export const usageTableHeaders = [
  'Period',
  'Source',
  'Models',
  'Input',
  'Output',
  'Reasoning',
  'Cache Read',
  'Cache Write',
  'Total',
  'Cost',
] as const;

const integerFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSource(row: UsageReportRow): string {
  if (row.rowType === 'grand_total') {
    return 'TOTAL';
  }

  return row.source;
}

function formatTokenCount(value: number | undefined): string {
  return integerFormatter.format(value ?? 0);
}

function formatUsd(value: number | undefined): string {
  if (value === undefined) {
    return '-';
  }

  return usdFormatter.format(value);
}

function buildModelLines(row: UsageReportRow): string[] {
  if (row.modelBreakdown.length > 0) {
    return row.modelBreakdown.map((modelUsage) => `• ${modelUsage.model}`);
  }

  return row.models.map((model) => `• ${model}`);
}

function formatModels(row: UsageReportRow, layout: UsageTableLayout): string {
  const modelLines = buildModelLines(row);

  if (modelLines.length === 0) {
    return '-';
  }

  if (layout === 'per_model_columns' && row.modelBreakdown.length > 1) {
    return [...modelLines, 'Σ TOTAL'].join('\n');
  }

  return modelLines.join('\n');
}

function formatModelMetric(
  row: UsageReportRow,
  selector: (value: ModelUsageBreakdown | UsageReportRow) => number | undefined,
  formatter: (value: number | undefined) => string,
  layout: UsageTableLayout,
): string {
  if (layout !== 'per_model_columns' || row.modelBreakdown.length === 0) {
    return formatter(selector(row));
  }

  const lines = row.modelBreakdown.map((modelUsage) => formatter(selector(modelUsage)));

  if (row.modelBreakdown.length > 1) {
    lines.push(formatter(selector(row)));
  }

  return lines.join('\n');
}

export function toUsageTableCells(
  rows: UsageReportRow[],
  options: { layout?: UsageTableLayout } = {},
): string[][] {
  const layout = options.layout ?? 'compact';

  return rows.map((row) => [
    row.periodKey,
    formatSource(row),
    formatModels(row, layout),
    formatModelMetric(row, (value) => value.inputTokens, formatTokenCount, layout),
    formatModelMetric(row, (value) => value.outputTokens, formatTokenCount, layout),
    formatModelMetric(row, (value) => value.reasoningTokens, formatTokenCount, layout),
    formatModelMetric(row, (value) => value.cacheReadTokens, formatTokenCount, layout),
    formatModelMetric(row, (value) => value.cacheWriteTokens, formatTokenCount, layout),
    formatModelMetric(row, (value) => value.totalTokens, formatTokenCount, layout),
    formatModelMetric(row, (value) => value.costUsd, formatUsd, layout),
  ]);
}
