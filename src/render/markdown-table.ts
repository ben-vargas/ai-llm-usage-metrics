import { markdownTable } from 'markdown-table';

import type { UsageReportRow } from '../domain/usage-report-row.js';
import { toUsageTableCells, usageTableHeaders } from './row-cells.js';

const alignment: ('l' | 'r')[] = ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'];

export function renderMarkdownTable(rows: UsageReportRow[]): string {
  const bodyRows = toUsageTableCells(rows);
  const tableRows = [Array.from(usageTableHeaders), ...bodyRows];

  return markdownTable(tableRows, {
    align: alignment,
  });
}
