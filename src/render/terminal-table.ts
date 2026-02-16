import type { UsageReportRow } from '../domain/usage-report-row.js';

type ColumnDefinition = {
  header: string;
  align: 'left' | 'right';
};

const columns: ColumnDefinition[] = [
  { header: 'Period', align: 'left' },
  { header: 'Source', align: 'left' },
  { header: 'Models', align: 'left' },
  { header: 'Input', align: 'right' },
  { header: 'Output', align: 'right' },
  { header: 'Reasoning', align: 'right' },
  { header: 'Cache Read', align: 'right' },
  { header: 'Cache Write', align: 'right' },
  { header: 'Total Tokens', align: 'right' },
  { header: 'Cost (USD)', align: 'right' },
];

const integerFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

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

function toStringRows(rows: UsageReportRow[]): string[][] {
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

function pad(value: string, width: number, align: 'left' | 'right'): string {
  if (align === 'right') {
    return value.padStart(width, ' ');
  }

  return value.padEnd(width, ' ');
}

function buildRow(values: string[], widths: number[]): string {
  const cells = values.map((value, index) =>
    pad(value, widths[index] ?? 0, columns[index]?.align ?? 'left'),
  );
  return `| ${cells.join(' | ')} |`;
}

export function renderTerminalTable(rows: UsageReportRow[]): string {
  const stringRows = toStringRows(rows);
  const widths = columns.map((column, index) => {
    const maxCellWidth = Math.max(...stringRows.map((row) => row[index]?.length ?? 0), 0);
    return Math.max(column.header.length, maxCellWidth);
  });

  const header = buildRow(
    columns.map((column) => column.header),
    widths,
  );
  const separator = `|-${widths.map((width) => '-'.repeat(width)).join('-|-')}-|`;
  const body = stringRows.map((row) => buildRow(row, widths));

  return [header, separator, ...body].join('\n');
}
