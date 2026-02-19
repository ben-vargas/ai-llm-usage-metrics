import pc from 'picocolors';

import type { UsageReportRow } from '../domain/usage-report-row.js';

export type TextStyler = (text: string) => string;

export type TerminalStylePalette = {
  cyan: TextStyler;
  magenta: TextStyler;
  blue: TextStyler;
  yellow: TextStyler;
  green: TextStyler;
  white: TextStyler;
  bold: TextStyler;
  dim: TextStyler;
};

export const defaultTerminalStylePalette: TerminalStylePalette = {
  cyan: pc.cyan,
  magenta: pc.magenta,
  blue: pc.blue,
  yellow: pc.yellow,
  green: pc.green,
  white: pc.white,
  bold: pc.bold,
  dim: pc.dim,
};

const passthroughStyler: TextStyler = (text) => text;

type SourceStylePolicy = (palette: TerminalStylePalette) => TextStyler;

const sourceStylePolicies = new Map<string, SourceStylePolicy>([
  ['pi', (palette) => palette.cyan],
  ['codex', (palette) => palette.magenta],
  ['opencode', (palette) => palette.blue],
]);

export function resolveSourceStyler(
  source: string,
  palette: TerminalStylePalette = defaultTerminalStylePalette,
): TextStyler {
  const stylePolicy = sourceStylePolicies.get(source);

  if (!stylePolicy) {
    return passthroughStyler;
  }

  return stylePolicy(palette);
}

type RowTypeStylePolicy = (cells: string[], palette: TerminalStylePalette) => string[];

const rowTypeStylePolicies: Record<UsageReportRow['rowType'], RowTypeStylePolicy> = {
  period_source: (cells, palette) => {
    const styledCells = [...cells];
    const costColumnIndex = styledCells.length - 1;

    styledCells[costColumnIndex] = palette.yellow(styledCells[costColumnIndex]);

    return styledCells;
  },
  period_combined: (cells, palette) =>
    cells.map((cell, cellIndex) => {
      if (cellIndex === 1) {
        return palette.bold(palette.yellow(cell));
      }

      return palette.dim(cell);
    }),
  grand_total: (cells, palette) =>
    cells.map((cell, cellIndex) => {
      if (cellIndex === 0) {
        return palette.bold(palette.white(cell));
      }

      if (cellIndex === 1) {
        return palette.bold(palette.green(cell));
      }

      return palette.bold(cell);
    }),
};

export function applyRowTypeStyle(
  rowType: UsageReportRow['rowType'],
  cells: string[],
  palette: TerminalStylePalette = defaultTerminalStylePalette,
): string[] {
  return rowTypeStylePolicies[rowType](cells, palette);
}

function applyBaseCellStyle(
  cells: string[],
  palette: TerminalStylePalette,
  sourceStyler: TextStyler,
): string[] {
  if (cells.length < 2) {
    return [...cells];
  }

  const styledCells = [...cells];

  styledCells[0] = palette.white(styledCells[0]);
  styledCells[1] = sourceStyler(styledCells[1]);

  return styledCells;
}

export function colorizeUsageBodyRows(
  bodyRows: string[][],
  rows: UsageReportRow[],
  options: {
    useColor: boolean;
    palette?: TerminalStylePalette;
  },
): string[][] {
  if (!options.useColor) {
    return bodyRows;
  }

  const palette = options.palette ?? defaultTerminalStylePalette;

  return rows.map((row, index) => {
    const sourceStyler =
      row.rowType === 'period_source'
        ? resolveSourceStyler(String(row.source), palette)
        : passthroughStyler;
    const baseStyledCells = applyBaseCellStyle(bodyRows[index], palette, sourceStyler);

    return applyRowTypeStyle(row.rowType, baseStyledCells, palette);
  });
}
