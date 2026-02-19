import { markdownTable } from 'markdown-table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { toUsageTableCells, type UsageTableLayout, usageTableHeaders } from './row-cells.js';

const alignment: ('l' | 'r')[] = ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'];

type MarkdownRenderOptions = {
  tableLayout?: UsageTableLayout;
};

function toMarkdownSafeCell(value: string): string {
  return value.replace(/\r?\n/gu, '<br>');
}

export function renderMarkdownTable(
  rows: UsageReportRow[],
  options: MarkdownRenderOptions = {},
): string {
  const tableLayout = options.tableLayout ?? 'compact';
  const bodyRows = toUsageTableCells(rows, { layout: tableLayout }).map((row) =>
    row.map((cell) => toMarkdownSafeCell(cell)),
  );
  const tableRows = [Array.from(usageTableHeaders), ...bodyRows];

  return markdownTable(tableRows, {
    align: alignment,
  });
}
