import pc from 'picocolors';
import { table, type TableUserConfig } from 'table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { colorizeUsageBodyRows } from './terminal-style-policy.js';
import { toUsageTableCells, type UsageTableLayout, usageTableHeaders } from './row-cells.js';

const modelsColumnIndex = 2;

type TerminalRenderOptions = {
  useColor?: boolean;
  tableLayout?: UsageTableLayout;
};

const roundedBorders = {
  topBody: '─',
  topJoin: '┬',
  topLeft: '╭',
  topRight: '╮',
  bottomBody: '─',
  bottomJoin: '┴',
  bottomLeft: '╰',
  bottomRight: '╯',
  bodyLeft: '│',
  bodyRight: '│',
  bodyJoin: '│',
  headerJoin: '┬',
  joinBody: '─',
  joinLeft: '├',
  joinRight: '┤',
  joinJoin: '┼',
  joinMiddleDown: '┬',
  joinMiddleUp: '┴',
  joinMiddleLeft: '┤',
  joinMiddleRight: '├',
};

function shouldDrawHorizontalLine(
  index: number,
  rowCount: number,
  usageRows: UsageReportRow[],
): boolean {
  if (index === 0 || index === 1 || index === rowCount) {
    return true;
  }

  const previousRow = usageRows[index - 2];
  const nextRow = usageRows[index - 1];

  return (
    previousRow.rowType === 'period_combined' ||
    nextRow.rowType === 'grand_total' ||
    previousRow.periodKey !== nextRow.periodKey
  );
}

function createTableConfig(
  tableLayout: UsageTableLayout,
  usageRows: UsageReportRow[],
): TableUserConfig {
  const rowVerticalAlignment = tableLayout === 'per_model_columns' ? 'top' : 'middle';

  return {
    border: roundedBorders,
    drawHorizontalLine: (index, rowCount) => shouldDrawHorizontalLine(index, rowCount, usageRows),
    columnDefault: {
      paddingLeft: 1,
      paddingRight: 1,
      verticalAlignment: 'top',
    },
    columns: {
      0: { alignment: 'left', verticalAlignment: rowVerticalAlignment },
      1: { alignment: 'left', verticalAlignment: rowVerticalAlignment },
      [modelsColumnIndex]: {
        alignment: 'left',
        width: 32,
        wrapWord: true,
      },
      3: { alignment: 'right', verticalAlignment: rowVerticalAlignment },
      4: { alignment: 'right', verticalAlignment: rowVerticalAlignment },
      5: { alignment: 'right', verticalAlignment: rowVerticalAlignment },
      6: { alignment: 'right', verticalAlignment: rowVerticalAlignment },
      7: { alignment: 'right', verticalAlignment: rowVerticalAlignment },
      8: { alignment: 'right', verticalAlignment: rowVerticalAlignment },
      9: { alignment: 'right', verticalAlignment: rowVerticalAlignment },
    },
  };
}

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
  const bodyRows = colorizeUsageBodyRows(uncoloredBodyRows, rows, { useColor });
  const displayRows = [colorizeHeader(useColor), ...bodyRows];

  return table(displayRows, createTableConfig(tableLayout, rows));
}
