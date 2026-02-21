import pc from 'picocolors';
import { visibleWidth } from './table-text-layout.js';

export type ReportHeaderOptions = {
  title: string;
  useColor?: boolean;
};

function getBoxWidth(content: string): number {
  return visibleWidth(content) + 4;
}

function drawBoxLine(width: number, left: string, middle: string, right: string): string {
  return left + middle.repeat(width - 2) + right;
}

function padLine(content: string, width: number): string {
  const padding = width - 2 - visibleWidth(content);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return '│' + ' '.repeat(leftPad) + content + ' '.repeat(rightPad) + '│';
}

export function renderReportHeader(options: ReportHeaderOptions): string {
  const { title, useColor = true } = options;
  const boxWidth = getBoxWidth(title);

  const lines: string[] = [];

  const topBorder = drawBoxLine(boxWidth, '┌', '─', '┐');
  lines.push(useColor ? pc.gray(topBorder) : topBorder);

  const titleLine = padLine(title, boxWidth);
  lines.push(useColor ? pc.white(titleLine) : titleLine);

  const bottomBorder = drawBoxLine(boxWidth, '└', '─', '┘');
  lines.push(useColor ? pc.gray(bottomBorder) : bottomBorder);

  return lines.join('\n');
}
