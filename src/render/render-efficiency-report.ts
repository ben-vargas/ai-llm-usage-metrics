import { markdownTable } from 'markdown-table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import type { EfficiencyDataResult } from '../cli/usage-data-contracts.js';
import type { EfficiencyRow } from '../efficiency/efficiency-row.js';
import type { ReportGranularity } from '../utils/time-buckets.js';
import { renderReportHeader } from './report-header.js';
import { efficiencyTableHeaders, toEfficiencyTableCells } from './efficiency-row-cells.js';
import { shouldUseColorByDefault } from './terminal-table.js';
import { renderUnicodeTable } from './unicode-table.js';

export type EfficiencyReportFormat = 'terminal' | 'markdown' | 'json';

export type RenderEfficiencyReportOptions = {
  granularity: ReportGranularity;
  useColor?: boolean;
};

function getReportTitle(granularity: ReportGranularity): string {
  switch (granularity) {
    case 'daily':
      return 'Daily Efficiency Report';
    case 'weekly':
      return 'Weekly Efficiency Report';
    case 'monthly':
      return 'Monthly Efficiency Report';
  }
}

function toTableSortRow(row: EfficiencyRow): UsageReportRow {
  if (row.rowType === 'grand_total') {
    return {
      rowType: 'grand_total',
      periodKey: 'ALL',
      source: 'combined',
      models: [],
      modelBreakdown: [],
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      reasoningTokens: row.reasoningTokens,
      cacheReadTokens: row.cacheReadTokens,
      cacheWriteTokens: row.cacheWriteTokens,
      totalTokens: row.totalTokens,
      costUsd: row.costUsd,
      costIncomplete: row.costIncomplete,
    };
  }

  return {
    rowType: 'period_source',
    periodKey: row.periodKey,
    source: 'combined',
    models: [],
    modelBreakdown: [],
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    reasoningTokens: row.reasoningTokens,
    cacheReadTokens: row.cacheReadTokens,
    cacheWriteTokens: row.cacheWriteTokens,
    totalTokens: row.totalTokens,
    costUsd: row.costUsd,
    costIncomplete: row.costIncomplete,
  };
}

function renderTerminalEfficiencyTable(rows: EfficiencyRow[]): string {
  const bodyRows = toEfficiencyTableCells(rows);
  const tableSortRows = rows.map((row) => toTableSortRow(row));
  const periodColumnWidth = Math.max(
    efficiencyTableHeaders[0].length,
    ...rows.map((row) => row.periodKey.length),
  );

  return renderUnicodeTable({
    headerCells: efficiencyTableHeaders,
    bodyRows,
    measureHeaderCells: efficiencyTableHeaders,
    measureBodyRows: bodyRows,
    usageRows: tableSortRows,
    tableLayout: 'compact',
    modelsColumnIndex: 0,
    modelsColumnWidth: periodColumnWidth,
  });
}

function toMarkdownSafeCell(value: string): string {
  return value.replace(/\r?\n/gu, '<br>');
}

function renderMarkdownEfficiencyTable(rows: EfficiencyRow[]): string {
  const bodyRows = toEfficiencyTableCells(rows).map((row) =>
    row.map((cell) => toMarkdownSafeCell(cell)),
  );
  const tableRows = [Array.from(efficiencyTableHeaders), ...bodyRows];
  const alignment = efficiencyTableHeaders.map((_, index) => (index === 0 ? 'l' : 'r')) as (
    | 'l'
    | 'r'
  )[];

  return markdownTable(tableRows, {
    align: alignment,
  });
}

function renderTerminalEfficiencyReport(
  efficiencyData: EfficiencyDataResult,
  options: RenderEfficiencyReportOptions,
): string {
  const outputLines: string[] = [];
  const useColor = options.useColor ?? shouldUseColorByDefault();

  outputLines.push(
    renderReportHeader({
      title: getReportTitle(options.granularity),
      useColor,
    }),
  );

  outputLines.push('');
  outputLines.push(renderTerminalEfficiencyTable(efficiencyData.rows));

  return outputLines.join('\n');
}

export function renderEfficiencyReport(
  efficiencyData: EfficiencyDataResult,
  format: EfficiencyReportFormat,
  options: RenderEfficiencyReportOptions,
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(efficiencyData.rows, null, 2);
    case 'markdown':
      return renderMarkdownEfficiencyTable(efficiencyData.rows);
    case 'terminal':
      return renderTerminalEfficiencyReport(efficiencyData, options);
  }
}
