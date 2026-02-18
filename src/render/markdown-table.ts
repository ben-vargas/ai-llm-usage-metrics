import { markdownTable } from 'markdown-table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { toUsageTableCells, usageTableHeaders } from './row-cells.js';

const alignment: ('l' | 'r')[] = ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'];

function toMarkdownSafeCell(value: string): string {
  return value.replaceAll('\n', '<br>');
}

export function renderMarkdownTable(rows: UsageReportRow[]): string {
  const bodyRows = toUsageTableCells(rows).map((row) =>
    row.map((cell) => toMarkdownSafeCell(cell)),
  );
  const tableRows = [Array.from(usageTableHeaders), ...bodyRows];

  return markdownTable(tableRows, {
    align: alignment,
  });
}
