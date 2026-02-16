import pc from 'picocolors';
import { getBorderCharacters, table, type TableUserConfig } from 'table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { toUsageTableCells, usageTableHeaders } from './row-cells.js';

const modelsColumnIndex = 2;

type TerminalRenderOptions = {
  useColor?: boolean;
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
    border: getBorderCharacters('norc'),
    drawHorizontalLine: (index, rowCount) => shouldDrawHorizontalLine(index, rowCount, rows),
    columnDefault: {
      paddingLeft: 1,
      paddingRight: 1,
      verticalAlignment: 'middle',
    },
    columns: {
      0: { alignment: 'left' },
      1: { alignment: 'left' },
      [modelsColumnIndex]: {
        alignment: 'left',
        width: 34,
        wrapWord: true,
      },
      3: { alignment: 'right' },
      4: { alignment: 'right' },
      5: { alignment: 'right' },
      6: { alignment: 'right' },
      7: { alignment: 'right' },
      8: { alignment: 'right' },
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

    styledCells[1] = sourceStyler(styledCells[1] ?? row.source);

    if (row.rowType === 'grand_total') {
      return styledCells.map((cell) => pc.bold(cell));
    }

    if (row.rowType === 'period_combined') {
      return styledCells.map((cell, cellIndex) => (cellIndex === 1 ? pc.bold(cell) : pc.dim(cell)));
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
