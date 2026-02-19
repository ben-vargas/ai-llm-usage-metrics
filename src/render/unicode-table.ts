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

function computeColumnWidths(
  measureRows: readonly (readonly string[])[],
  options: { modelsColumnIndex: number; modelsColumnWidth: number },
): number[] {
  const columnCount = measureRows[0]?.length ?? 0;
  const widths = Array.from({ length: columnCount }, () => 0);

  for (const row of measureRows) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      for (const line of splitCellLines(row[columnIndex])) {
        widths[columnIndex] = Math.max(widths[columnIndex], visibleWidth(line));
      }
    }
  }

  widths[options.modelsColumnIndex] = options.modelsColumnWidth;

  return widths;
}

export function renderUnicodeTable(options: RenderUnicodeTableOptions): string {
  const measureRows = [options.measureHeaderCells, ...options.measureBodyRows];
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
    ...toRenderableRowLines(options.headerCells, {
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

  options.bodyRows.forEach((row, rowIndex) => {
    renderedLines.push(
      ...toRenderableRowLines(row, {
        widths,
        tableLayout: options.tableLayout,
        modelsColumnIndex: options.modelsColumnIndex,
      }),
    );

    if (
      rowIndex < options.bodyRows.length - 1 &&
      shouldDrawBodySeparator(rowIndex, options.usageRows)
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
