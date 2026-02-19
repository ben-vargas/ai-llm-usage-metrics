import pc from 'picocolors';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { colorizeUsageBodyRows } from './terminal-style-policy.js';
import { toUsageTableCells, type UsageTableLayout, usageTableHeaders } from './row-cells.js';
import { wrapTableColumn } from './table-text-layout.js';
import { renderUnicodeTable } from './unicode-table.js';

const modelsColumnIndex = 2;
const modelsColumnWidth = 32;

type TerminalRenderOptions = {
  useColor?: boolean;
  tableLayout?: UsageTableLayout;
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

export function renderTerminalTable(
  rows: UsageReportRow[],
  options: TerminalRenderOptions = {},
): string {
  const useColor = options.useColor ?? shouldUseColorByDefault();
  const tableLayout = options.tableLayout ?? 'compact';
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
