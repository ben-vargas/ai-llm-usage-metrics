import type { UsageReportRow } from '../domain/usage-report-row.js';

const integerFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

const headers = [
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
];

function formatTokenCount(value: number): string {
  return integerFormatter.format(value);
}

function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

function formatSource(row: UsageReportRow): string {
  if (row.rowType === 'grand_total') {
    return 'TOTAL';
  }

  return row.source;
}

function formatModels(models: string[]): string {
  return models.length > 0 ? models.join(', ') : '-';
}

function toMarkdownRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

export function renderMarkdownTable(rows: UsageReportRow[]): string {
  const headerRow = toMarkdownRow(headers);
  const separatorRow = toMarkdownRow(headers.map(() => '---'));
  const bodyRows = rows.map((row) =>
    toMarkdownRow([
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
    ]),
  );

  return [headerRow, separatorRow, ...bodyRows].join('\n');
}
