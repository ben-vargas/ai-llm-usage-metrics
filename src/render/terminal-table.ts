import pc from 'picocolors';
import { table, type TableUserConfig } from 'table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { toUsageTableCells, usageTableHeaders } from './row-cells.js';

const modelsColumnIndex = 2;

type TerminalRenderOptions = {
  useColor?: boolean;
};

// Custom rounded border characters for cleaner aesthetics
// Following table library's BorderCharacters schema
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

function shouldDrawHorizontalLine(index: number, rowCount: number, rows: string[][]): boolean {
  if (index === 0 || index === 1 || index === rowCount) {
    return true;
  }

  const previousRow = rows[index - 1];
  const nextRow = rows[index];

  const previousSource = previousRow[1];
  const nextSource = nextRow[1];
  const previousPeriod = previousRow[0];
  const nextPeriod = nextRow[0];

  return previousSource === 'combined' || nextSource === 'TOTAL' || previousPeriod !== nextPeriod;
}

function createTableConfig(rows: string[][]): TableUserConfig {
  return {
    border: roundedBorders,
    drawHorizontalLine: (index, rowCount) => shouldDrawHorizontalLine(index, rowCount, rows),
    columnDefault: {
      paddingLeft: 1,
      paddingRight: 1,
      verticalAlignment: 'top',
    },
    columns: {
      0: { alignment: 'left', verticalAlignment: 'middle' },
      1: { alignment: 'left', verticalAlignment: 'middle' },
      [modelsColumnIndex]: {
        alignment: 'left',
        width: 32,
        wrapWord: true,
      },
      3: { alignment: 'right', verticalAlignment: 'middle' },
      4: { alignment: 'right', verticalAlignment: 'middle' },
      5: { alignment: 'right', verticalAlignment: 'middle' },
      6: { alignment: 'right', verticalAlignment: 'middle' },
      7: { alignment: 'right', verticalAlignment: 'middle' },
      8: { alignment: 'right', verticalAlignment: 'middle' },
      9: { alignment: 'right', verticalAlignment: 'middle' },
    },
  };
}

function shouldUseColorByDefault(): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') {
    return true;
  }

  return process.stdout.isTTY;
}

function colorSource(source: string): (text: string) => string {
  switch (source) {
    case 'pi':
      return pc.cyan;
    case 'codex':
      return pc.magenta;
    case 'combined':
      return pc.yellow;
    case 'TOTAL':
      return (text) => pc.bold(pc.green(text));
    default:
      return (text) => text;
  }
}

function colorPeriod(period: string): string {
  // Colorize month names for better readability
  if (period.includes(' ')) {
    const [month, year] = period.split(' ');
    return `${pc.cyan(month)} ${pc.white(year)}`;
  }
  return pc.white(period);
}

function colorizeBodyRows(
  bodyRows: string[][],
  rows: UsageReportRow[],
  useColor: boolean,
): string[][] {
  if (!useColor) {
    return bodyRows;
  }

  return rows.map((row, index) => {
    const styledCells = [...(bodyRows[index] ?? [])];
    const sourceStyler = colorSource(styledCells[1] ?? row.source);

    // Colorize period
    styledCells[0] = colorPeriod(styledCells[0] ?? row.periodKey);
    // Colorize source
    styledCells[1] = sourceStyler(styledCells[1] ?? row.source);

    if (row.rowType === 'grand_total') {
      return styledCells.map((cell, cellIndex) => {
        if (cellIndex === 0) return pc.bold(pc.white(cell));
        if (cellIndex === 1) return cell; // Already styled
        return pc.bold(cell);
      });
    }

    if (row.rowType === 'period_combined') {
      return styledCells.map((cell, cellIndex) => {
        if (cellIndex === 1) return pc.bold(cell); // Source already styled
        return pc.dim(cell);
      });
    }

    // For numeric columns, use subtle coloring
    for (let i = 3; i < styledCells.length; i++) {
      if (i === styledCells.length - 1) {
        // Cost column - highlight
        styledCells[i] = pc.yellow(styledCells[i]);
      }
    }

    return styledCells;
  });
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
  const bodyRows = colorizeBodyRows(toUsageTableCells(rows), rows, useColor);
  const displayRows = [colorizeHeader(useColor), ...bodyRows];

  return table(displayRows, createTableConfig(displayRows));
}
