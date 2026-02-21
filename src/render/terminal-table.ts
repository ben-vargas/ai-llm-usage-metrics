import pc from 'picocolors';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { colorizeUsageBodyRows } from './terminal-style-policy.js';
import { toUsageTableCells, type UsageTableLayout, usageTableHeaders } from './row-cells.js';
import { visibleWidth, wrapTableColumn } from './table-text-layout.js';
import { renderUnicodeTable } from './unicode-table.js';

const modelsColumnIndex = 2;
const defaultModelsColumnWidth = 32;
const minimumModelsColumnWidth = 12;

type TerminalRenderOptions = {
  useColor?: boolean;
  tableLayout?: UsageTableLayout;
  terminalWidth?: number;
};

export function shouldUseColorByDefault(): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  if (process.env.FORCE_COLOR !== undefined) {
    return process.env.FORCE_COLOR !== '0';
  }

  const stdoutIsTTY = (process.stdout as { isTTY: unknown }).isTTY;
  return stdoutIsTTY === true;
}

function colorizeHeader(useColor: boolean): string[] {
  const headerCells = Array.from(usageTableHeaders);

  if (!useColor) {
    return headerCells;
  }

  return headerCells.map((header) => pc.bold(pc.white(header)));
}

function resolveTerminalWidth(override: number | undefined): number | undefined {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }

  const stdoutState = process.stdout as { isTTY?: unknown; columns?: unknown };

  if (stdoutState.isTTY !== true) {
    return undefined;
  }

  return typeof stdoutState.columns === 'number' &&
    Number.isFinite(stdoutState.columns) &&
    stdoutState.columns > 0
    ? Math.floor(stdoutState.columns)
    : undefined;
}

function measureTableWidth(tableOutput: string): number {
  return tableOutput
    .trimEnd()
    .split('\n')
    .reduce((maxWidth, line) => Math.max(maxWidth, visibleWidth(line)), 0);
}

function renderTableWithModelsWidth(
  rows: UsageReportRow[],
  tableLayout: UsageTableLayout,
  useColor: boolean,
  modelsColumnWidth: number,
): string {
  const uncoloredBodyRows = toUsageTableCells(rows, { layout: tableLayout });
  const wrappedBodyRows = wrapTableColumn(uncoloredBodyRows, {
    columnIndex: modelsColumnIndex,
    width: modelsColumnWidth,
  });
  const bodyRows = colorizeUsageBodyRows(wrappedBodyRows, rows, { useColor });

  return renderUnicodeTable({
    headerCells: colorizeHeader(useColor),
    bodyRows,
    measureHeaderCells: usageTableHeaders,
    measureBodyRows: wrappedBodyRows,
    usageRows: rows,
    tableLayout,
    modelsColumnIndex,
    modelsColumnWidth,
  });
}

export function renderTerminalTable(
  rows: UsageReportRow[],
  options: TerminalRenderOptions = {},
): string {
  const useColor = options.useColor ?? shouldUseColorByDefault();
  const tableLayout = options.tableLayout ?? 'compact';
  const terminalWidth = resolveTerminalWidth(options.terminalWidth);
  let modelsColumnWidth = defaultModelsColumnWidth;
  let renderedTable = renderTableWithModelsWidth(rows, tableLayout, useColor, modelsColumnWidth);

  if (terminalWidth !== undefined) {
    const renderedTableWidth = measureTableWidth(renderedTable);

    if (renderedTableWidth > terminalWidth) {
      const overflowColumns = renderedTableWidth - terminalWidth;
      modelsColumnWidth = Math.max(minimumModelsColumnWidth, modelsColumnWidth - overflowColumns);

      if (modelsColumnWidth !== defaultModelsColumnWidth) {
        renderedTable = renderTableWithModelsWidth(rows, tableLayout, useColor, modelsColumnWidth);
      }
    }
  }

  return renderedTable;
}
