import { getBorderCharacters, table, type TableUserConfig } from 'table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { toUsageTableCells, usageTableHeaders } from './row-cells.js';

const modelsColumnIndex = 2;

function shouldDrawHorizontalLine(index: number, rowCount: number, rows: string[][]): boolean {
  if (index === 0 || index === 1 || index === rowCount) {
    return true;
  }

  const previousRow = rows[index - 1];
  const nextRow = rows[index];

  const previousSource = previousRow[1];
  const nextSource = nextRow[1];

  return previousSource === 'combined' || previousSource === 'TOTAL' || nextSource === 'TOTAL';
}

function createTableConfig(rows: string[][]): TableUserConfig {
  return {
    border: getBorderCharacters('honeywell'),
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
      9: { alignment: 'right' },
    },
  };
}

export function renderTerminalTable(rows: UsageReportRow[]): string {
  const bodyRows = toUsageTableCells(rows);
  const displayRows = [Array.from(usageTableHeaders), ...bodyRows];

  return table(displayRows, createTableConfig(displayRows));
}
