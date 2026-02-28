import { markdownTable } from 'markdown-table';
import pc from 'picocolors';

import type { OptimizeDataResult } from '../cli/usage-data-contracts.js';
import type { UsageReportRow } from '../domain/usage-report-row.js';
import type { ReportGranularity } from '../utils/time-buckets.js';
import { visibleWidth } from './table-text-layout.js';
import { renderReportHeader } from './report-header.js';
import { shouldUseColorByDefault } from './terminal-table.js';
import { renderUnicodeTable } from './unicode-table.js';

export type OptimizeReportFormat = 'terminal' | 'markdown' | 'json';

export type RenderOptimizeReportOptions = {
  granularity: ReportGranularity;
  useColor?: boolean;
};

const optimizeTableHeaders = [
  'Period',
  'Candidate',
  'Hypothetical Cost',
  'Baseline Cost',
  'Savings',
  'Savings %',
  'Notes',
] as const;

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getReportTitle(granularity: ReportGranularity): string {
  switch (granularity) {
    case 'daily':
      return 'Daily Optimize Report';
    case 'weekly':
      return 'Weekly Optimize Report';
    case 'monthly':
      return 'Monthly Optimize Report';
  }
}

function formatUsd(value: number | undefined, options: { approximate?: boolean } = {}): string {
  if (value === undefined) {
    return '-';
  }

  const formatted = usdFormatter.format(value);
  return options.approximate ? `~${formatted}` : formatted;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) {
    return '-';
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatNotes(notes: string[] | undefined): string {
  if (!notes || notes.length === 0) {
    return '-';
  }

  return notes.join(', ');
}

function styleCandidateCell(
  candidateValue: string,
  rowType: 'baseline' | 'candidate',
  useColor: boolean,
): string {
  if (!useColor) {
    return candidateValue;
  }

  if (rowType === 'baseline') {
    return pc.bold(pc.cyan(candidateValue));
  }

  return pc.bold(candidateValue);
}

function styleDeltaCell(
  value: number | undefined,
  formattedValue: string,
  useColor: boolean,
): string {
  if (!useColor || value === undefined) {
    return formattedValue;
  }

  if (value > 0) {
    return pc.green(formattedValue);
  }

  if (value < 0) {
    return pc.red(formattedValue);
  }

  return pc.dim(formattedValue);
}

function styleNotesCell(
  notes: string[] | undefined,
  formattedNotes: string,
  useColor: boolean,
): string {
  if (!useColor || !notes || notes.length === 0) {
    return formattedNotes;
  }

  return pc.yellow(formattedNotes);
}

function toTableCells(
  optimizeData: OptimizeDataResult,
  options: { useColor: boolean },
): string[][] {
  const baselineByPeriod = new Map(
    optimizeData.rows
      .filter((row) => row.rowType === 'baseline')
      .map((row) => [row.periodKey, row]),
  );

  return optimizeData.rows.map((row) => {
    const baselineRow = baselineByPeriod.get(row.periodKey);
    const periodCell =
      options.useColor && row.periodKey === 'ALL' ? pc.bold(row.periodKey) : row.periodKey;

    if (row.rowType === 'baseline') {
      return [
        periodCell,
        styleCandidateCell('BASELINE', 'baseline', options.useColor),
        '-',
        formatUsd(row.baselineCostUsd, { approximate: row.baselineCostIncomplete }),
        '-',
        '-',
        '-',
      ];
    }

    const savingsCell = formatUsd(row.savingsUsd);
    const savingsPctCell = formatPercent(row.savingsPct);
    const notesCell = formatNotes(row.notes);

    return [
      periodCell,
      styleCandidateCell(row.candidateModel, 'candidate', options.useColor),
      formatUsd(row.hypotheticalCostUsd, { approximate: row.hypotheticalCostIncomplete }),
      formatUsd(baselineRow?.baselineCostUsd, {
        approximate: baselineRow?.baselineCostIncomplete === true,
      }),
      styleDeltaCell(row.savingsUsd, savingsCell, options.useColor),
      styleDeltaCell(row.savingsPct, savingsPctCell, options.useColor),
      styleNotesCell(row.notes, notesCell, options.useColor),
    ];
  });
}

function toMarkdownSafeCell(value: string): string {
  return value.replace(/\r?\n/gu, '<br>');
}

function toSortingUsageRows(optimizeData: OptimizeDataResult): UsageReportRow[] {
  return optimizeData.rows.map((row) => {
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
      costUsd: row.rowType === 'baseline' ? row.baselineCostUsd : row.hypotheticalCostUsd,
      costIncomplete:
        row.rowType === 'baseline' ? row.baselineCostIncomplete : row.hypotheticalCostIncomplete,
    };
  });
}

function resolveCandidateColumnWidth(tableCells: string[][]): number {
  return tableCells.reduce((maxWidth, row) => {
    const candidateValue = row[1] ?? '';
    return Math.max(maxWidth, visibleWidth(candidateValue));
  }, visibleWidth(optimizeTableHeaders[1]));
}

function renderTerminalOptimizeReport(
  optimizeData: OptimizeDataResult,
  options: RenderOptimizeReportOptions,
): string {
  const useColor = options.useColor ?? shouldUseColorByDefault();
  const tableCells = toTableCells(optimizeData, { useColor });
  const candidateColumnWidth = resolveCandidateColumnWidth(tableCells);
  const outputLines: string[] = [];

  outputLines.push(
    renderReportHeader({
      title: getReportTitle(options.granularity),
      useColor,
    }),
  );
  outputLines.push('');
  outputLines.push(
    renderUnicodeTable({
      headerCells: [...optimizeTableHeaders],
      bodyRows: tableCells,
      measureHeaderCells: [...optimizeTableHeaders],
      measureBodyRows: tableCells,
      usageRows: toSortingUsageRows(optimizeData),
      tableLayout: 'compact',
      modelsColumnIndex: 1,
      modelsColumnWidth: candidateColumnWidth,
    }),
  );

  return outputLines.join('\n');
}

function renderMarkdownOptimizeReport(optimizeData: OptimizeDataResult): string {
  const bodyRows = toTableCells(optimizeData, { useColor: false }).map((row) =>
    row.map((cell) => toMarkdownSafeCell(cell)),
  );
  const tableRows = [[...optimizeTableHeaders], ...bodyRows];
  const alignment = optimizeTableHeaders.map((_, index) => (index <= 1 ? 'l' : 'r')) as (
    | 'l'
    | 'r'
  )[];

  return markdownTable(tableRows, { align: alignment });
}

export function renderOptimizeReport(
  optimizeData: OptimizeDataResult,
  format: OptimizeReportFormat,
  options: RenderOptimizeReportOptions,
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(optimizeData.rows, null, 2);
    case 'markdown':
      return renderMarkdownOptimizeReport(optimizeData);
    case 'terminal':
      return renderTerminalOptimizeReport(optimizeData, options);
  }
}
