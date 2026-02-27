import { markdownTable } from 'markdown-table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import type { EfficiencyDataResult } from '../cli/usage-data-contracts.js';
import type { EfficiencyRow } from '../efficiency/efficiency-row.js';
import type { ReportGranularity } from '../utils/time-buckets.js';
import { renderReportHeader } from './report-header.js';
import { efficiencyTableHeaders, toEfficiencyTableCells } from './efficiency-row-cells.js';
import {
  resolveTtyColumns,
  splitCellLines,
  visibleWidth,
  wrapTableColumn,
} from './table-text-layout.js';
import { shouldUseColorByDefault } from './terminal-table.js';
import { renderUnicodeTable } from './unicode-table.js';

export type EfficiencyReportFormat = 'terminal' | 'markdown' | 'json';

export type RenderEfficiencyReportOptions = {
  granularity: ReportGranularity;
  useColor?: boolean;
};

const periodColumnIndex = 0;
const minimumEfficiencyColumnWidth = 1;

type FittedEfficiencyTableCells = {
  headerCells: string[];
  bodyRows: string[][];
  widths: number[];
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

function measureRenderedTableWidth(columnWidths: number[]): number {
  if (columnWidths.length === 0) {
    return 0;
  }

  return columnWidths.reduce((sum, width) => sum + width, 0) + columnWidths.length * 3 + 1;
}

function computeColumnWidths(
  headerCells: readonly string[],
  bodyRows: readonly string[][],
): number[] {
  const columnCount = Math.max(
    headerCells.length,
    ...bodyRows.map((row) => row.length),
    efficiencyTableHeaders.length,
  );
  const widths = Array.from({ length: columnCount }, () => 0);

  const measureRow = (row: readonly string[]) => {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      for (const line of splitCellLines(row[columnIndex] ?? '')) {
        widths[columnIndex] = Math.max(widths[columnIndex], visibleWidth(line));
      }
    }
  };

  measureRow(headerCells);

  for (const row of bodyRows) {
    measureRow(row);
  }

  return widths;
}

function resolveWrappedCells(
  headerCells: readonly string[],
  bodyRows: readonly string[][],
  widths: readonly number[],
): { wrappedHeaderCells: string[]; wrappedBodyRows: string[][] } {
  let wrappedHeaderCells = [...headerCells];
  let wrappedBodyRows = bodyRows.map((row) => [...row]);

  for (let columnIndex = 0; columnIndex < widths.length; columnIndex += 1) {
    const columnWidth = widths[columnIndex] ?? 0;

    if (columnWidth <= 0) {
      continue;
    }

    wrappedHeaderCells =
      wrapTableColumn([wrappedHeaderCells], {
        columnIndex,
        width: columnWidth,
      })[0] ?? [];
    wrappedBodyRows = wrapTableColumn(wrappedBodyRows, {
      columnIndex,
      width: columnWidth,
    });
  }

  return {
    wrappedHeaderCells,
    wrappedBodyRows,
  };
}

function fitTableCellsToTerminal(
  headerCells: readonly string[],
  bodyRows: readonly string[][],
): FittedEfficiencyTableCells {
  const naturalWidths = computeColumnWidths(headerCells, bodyRows);
  const terminalWidth = resolveTtyColumns(process.stdout as { isTTY?: unknown; columns?: unknown });

  if (terminalWidth === undefined || measureRenderedTableWidth(naturalWidths) <= terminalWidth) {
    return {
      headerCells: [...headerCells],
      bodyRows: bodyRows.map((row) => [...row]),
      widths: naturalWidths,
    };
  }

  const constrainedWidths = [...naturalWidths];
  let renderedTableWidth = measureRenderedTableWidth(constrainedWidths);

  while (
    renderedTableWidth > terminalWidth &&
    constrainedWidths.some((width) => width > minimumEfficiencyColumnWidth)
  ) {
    let widestIndex = -1;
    let widestWidth = -1;

    for (let columnIndex = 0; columnIndex < constrainedWidths.length; columnIndex += 1) {
      const columnWidth = constrainedWidths[columnIndex];

      if (columnWidth <= minimumEfficiencyColumnWidth || columnWidth <= widestWidth) {
        continue;
      }

      widestIndex = columnIndex;
      widestWidth = columnWidth;
    }

    if (widestIndex === -1) {
      break;
    }

    const overflowColumns = renderedTableWidth - terminalWidth;
    const maxReducibleWidth = widestWidth - minimumEfficiencyColumnWidth;
    const reduction = Math.min(overflowColumns, maxReducibleWidth);

    if (reduction <= 0) {
      break;
    }

    constrainedWidths[widestIndex] -= reduction;
    renderedTableWidth -= reduction;
  }

  const { wrappedHeaderCells, wrappedBodyRows } = resolveWrappedCells(
    headerCells,
    bodyRows,
    constrainedWidths,
  );

  return {
    headerCells: wrappedHeaderCells,
    bodyRows: wrappedBodyRows,
    widths: constrainedWidths,
  };
}

function renderTerminalEfficiencyTable(rows: EfficiencyRow[]): string {
  const headerCells = Array.from(efficiencyTableHeaders);
  const bodyRows = toEfficiencyTableCells(rows);
  const tableSortRows = rows.map((row) => toTableSortRow(row));
  const fittedCells = fitTableCellsToTerminal(headerCells, bodyRows);

  return renderUnicodeTable({
    headerCells: fittedCells.headerCells,
    bodyRows: fittedCells.bodyRows,
    measureHeaderCells: fittedCells.headerCells,
    measureBodyRows: fittedCells.bodyRows,
    usageRows: tableSortRows,
    tableLayout: 'compact',
    modelsColumnIndex: periodColumnIndex,
    modelsColumnWidth:
      fittedCells.widths[periodColumnIndex] ?? efficiencyTableHeaders[periodColumnIndex].length,
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
