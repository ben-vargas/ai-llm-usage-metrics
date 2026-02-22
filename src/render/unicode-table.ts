import type { UsageReportRow } from '../domain/usage-report-row.js';
import { splitCellLines, visibleWidth } from './table-text-layout.js';
import type { UsageTableLayout } from './row-cells.js';

type TableAlignment = 'left' | 'right';
type TableVerticalAlignment = 'top' | 'middle';

type RenderUnicodeTableOptions = {
  headerCells: readonly string[];
  bodyRows: string[][];
  measureHeaderCells: readonly string[];
  measureBodyRows: string[][];
  usageRows: UsageReportRow[];
  tableLayout: UsageTableLayout;
  modelsColumnIndex: number;
  modelsColumnWidth: number;
};

type BorderChars = {
  left: string;
  join: string;
  right: string;
};

type RowType = UsageReportRow['rowType'];

type RenderableUsageRow = {
  usageRow: UsageReportRow;
  bodyRow: string[];
  measureBodyRow: string[];
  originalIndex: number;
};

function getColumnAlignment(columnIndex: number, modelsColumnIndex: number): TableAlignment {
  if (columnIndex <= modelsColumnIndex) {
    return 'left';
  }

  return 'right';
}

function getVerticalAlignment(
  columnIndex: number,
  tableLayout: UsageTableLayout,
  modelsColumnIndex: number,
): TableVerticalAlignment {
  if (columnIndex === modelsColumnIndex) {
    return 'top';
  }

  return tableLayout === 'per_model_columns' ? 'top' : 'middle';
}

function alignCellLine(value: string, width: number, alignment: TableAlignment): string {
  const padding = Math.max(0, width - visibleWidth(value));

  if (alignment === 'right') {
    return `${' '.repeat(padding)}${value}`;
  }

  return `${value}${' '.repeat(padding)}`;
}

function padCellLines(
  lines: string[],
  rowHeight: number,
  verticalAlignment: TableVerticalAlignment,
): string[] {
  const missingLineCount = rowHeight - lines.length;

  if (missingLineCount <= 0) {
    return lines;
  }

  if (verticalAlignment === 'top') {
    return [...lines, ...Array.from({ length: missingLineCount }, () => '')];
  }

  const topPadding = Math.floor(missingLineCount / 2);
  const bottomPadding = missingLineCount - topPadding;

  return [
    ...Array.from({ length: topPadding }, () => ''),
    ...lines,
    ...Array.from({ length: bottomPadding }, () => ''),
  ];
}

function toRenderableRowLines(
  row: readonly string[],
  options: {
    widths: number[];
    tableLayout: UsageTableLayout;
    modelsColumnIndex: number;
  },
): string[] {
  const cellLines = row.map((cell) => splitCellLines(cell));
  const rowHeight = cellLines.reduce((max, lines) => Math.max(max, lines.length), 1);

  const paddedAlignedColumns = cellLines.map((lines, columnIndex) => {
    const verticalAlignment = getVerticalAlignment(
      columnIndex,
      options.tableLayout,
      options.modelsColumnIndex,
    );
    const alignedLines = padCellLines(lines, rowHeight, verticalAlignment);
    const horizontalAlignment = getColumnAlignment(columnIndex, options.modelsColumnIndex);

    return alignedLines.map((line) =>
      alignCellLine(line, options.widths[columnIndex], horizontalAlignment),
    );
  });

  return Array.from({ length: rowHeight }, (_, lineIndex) => {
    const lineCells = paddedAlignedColumns.map((columnLines) => columnLines[lineIndex]);
    return `│ ${lineCells.join(' │ ')} │`;
  });
}

function buildBorderLine(widths: number[], chars: BorderChars): string {
  const segments = widths.map((width) => '─'.repeat(width + 2));
  return `${chars.left}${segments.join(chars.join)}${chars.right}`;
}

function shouldDrawBodySeparator(index: number, usageRows: UsageReportRow[]): boolean {
  if (index < 0 || index >= usageRows.length - 1) {
    return false;
  }

  const previousRow = usageRows[index];
  const nextRow = usageRows[index + 1];

  return (
    previousRow.rowType === 'period_combined' ||
    nextRow.rowType === 'grand_total' ||
    previousRow.periodKey !== nextRow.periodKey
  );
}

function getRowTypeWeight(rowType: RowType): number {
  switch (rowType) {
    case 'period_source':
      return 0;
    case 'period_combined':
      return 1;
    case 'grand_total':
      return 2;
  }
}

function getPeriodSortTuple(periodKey: string): [number, string] {
  if (periodKey === 'ALL') {
    return [1, periodKey];
  }

  return [0, periodKey];
}

function compareUsageRows(left: UsageReportRow, right: UsageReportRow): number {
  const [leftPeriodGroup, leftPeriodKey] = getPeriodSortTuple(left.periodKey);
  const [rightPeriodGroup, rightPeriodKey] = getPeriodSortTuple(right.periodKey);

  if (leftPeriodGroup !== rightPeriodGroup) {
    return leftPeriodGroup - rightPeriodGroup;
  }

  if (leftPeriodKey !== rightPeriodKey) {
    return leftPeriodKey < rightPeriodKey ? -1 : 1;
  }

  return getRowTypeWeight(left.rowType) - getRowTypeWeight(right.rowType);
}

function padRowToColumnCount(row: string[] | undefined, columnCount: number): string[] {
  const normalizedRow = row ?? [];

  if (normalizedRow.length >= columnCount) {
    return normalizedRow;
  }

  return [
    ...normalizedRow,
    ...Array.from({ length: columnCount - normalizedRow.length }, () => ''),
  ];
}

function getMaxRowColumnCount(
  rows: readonly (readonly string[])[],
  minimumColumnCount: number,
): number {
  return rows.reduce(
    (maxColumnCount, row) => Math.max(maxColumnCount, row.length),
    minimumColumnCount,
  );
}

function normalizeRenderableUsageRows(options: {
  usageRows: UsageReportRow[];
  bodyRows: string[][];
  measureBodyRows: string[][];
  bodyColumnCount: number;
  measureColumnCount: number;
}): RenderableUsageRow[] {
  const hasAlignedRowCounts =
    options.usageRows.length === options.bodyRows.length &&
    options.usageRows.length === options.measureBodyRows.length;

  if (!hasAlignedRowCounts) {
    return options.usageRows.map((usageRow, index) => ({
      usageRow,
      bodyRow: padRowToColumnCount(options.bodyRows[index], options.bodyColumnCount),
      measureBodyRow: padRowToColumnCount(
        options.measureBodyRows[index],
        options.measureColumnCount,
      ),
      originalIndex: index,
    }));
  }

  return options.usageRows
    .map((usageRow, index) => ({
      usageRow,
      bodyRow: padRowToColumnCount(options.bodyRows[index], options.bodyColumnCount),
      measureBodyRow: padRowToColumnCount(
        options.measureBodyRows[index],
        options.measureColumnCount,
      ),
      originalIndex: index,
    }))
    .sort((left, right) => {
      const comparison = compareUsageRows(left.usageRow, right.usageRow);

      if (comparison !== 0) {
        return comparison;
      }

      return left.originalIndex - right.originalIndex;
    });
}

function computeColumnWidths(
  measureRows: readonly (readonly string[])[],
  options: { modelsColumnIndex: number; modelsColumnWidth: number },
): number[] {
  const columnCount = measureRows.reduce(
    (maxColumnCount, row) => Math.max(maxColumnCount, row.length),
    0,
  );
  const widths = Array.from({ length: columnCount }, () => 0);

  for (const row of measureRows) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      for (const line of splitCellLines(row[columnIndex] ?? '')) {
        widths[columnIndex] = Math.max(widths[columnIndex], visibleWidth(line));
      }
    }
  }

  widths[options.modelsColumnIndex] = options.modelsColumnWidth;

  return widths;
}

export function renderUnicodeTable(options: RenderUnicodeTableOptions): string {
  const bodyColumnCount = getMaxRowColumnCount(options.bodyRows, options.headerCells.length);
  const measureColumnCount = getMaxRowColumnCount(
    options.measureBodyRows,
    options.measureHeaderCells.length,
  );
  const normalizedHeaderCells = padRowToColumnCount([...options.headerCells], bodyColumnCount);
  const normalizedMeasureHeaderCells = padRowToColumnCount(
    [...options.measureHeaderCells],
    measureColumnCount,
  );
  const normalizedRenderableRows = normalizeRenderableUsageRows({
    usageRows: options.usageRows,
    bodyRows: options.bodyRows,
    measureBodyRows: options.measureBodyRows,
    bodyColumnCount,
    measureColumnCount,
  });
  const normalizedBodyRows = normalizedRenderableRows.map((row) => row.bodyRow);
  const normalizedMeasureBodyRows = normalizedRenderableRows.map((row) => row.measureBodyRow);
  const normalizedUsageRows = normalizedRenderableRows.map((row) => row.usageRow);
  const measureRows = [normalizedMeasureHeaderCells, ...normalizedMeasureBodyRows];
  const widths = computeColumnWidths(measureRows, {
    modelsColumnIndex: options.modelsColumnIndex,
    modelsColumnWidth: options.modelsColumnWidth,
  });
  const renderedLines: string[] = [];

  renderedLines.push(
    buildBorderLine(widths, {
      left: '╭',
      join: '┬',
      right: '╮',
    }),
  );
  renderedLines.push(
    ...toRenderableRowLines(normalizedHeaderCells, {
      widths,
      tableLayout: 'per_model_columns',
      modelsColumnIndex: options.modelsColumnIndex,
    }),
  );
  renderedLines.push(
    buildBorderLine(widths, {
      left: '├',
      join: '┼',
      right: '┤',
    }),
  );

  normalizedBodyRows.forEach((row, rowIndex) => {
    renderedLines.push(
      ...toRenderableRowLines(row, {
        widths,
        tableLayout: options.tableLayout,
        modelsColumnIndex: options.modelsColumnIndex,
      }),
    );

    if (
      rowIndex < normalizedBodyRows.length - 1 &&
      shouldDrawBodySeparator(rowIndex, normalizedUsageRows)
    ) {
      renderedLines.push(
        buildBorderLine(widths, {
          left: '├',
          join: '┼',
          right: '┤',
        }),
      );
    }
  });

  renderedLines.push(
    buildBorderLine(widths, {
      left: '╰',
      join: '┴',
      right: '╯',
    }),
  );

  return `${renderedLines.join('\n')}\n`;
}
