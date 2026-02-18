import pc from 'picocolors';

export type ReportHeaderOptions = {
  title: string;
  timezone: string;
  useColor?: boolean;
};

function getBoxWidth(content: string): number {
  return content.length + 4; // 2 spaces padding on each side
}

function drawBoxLine(width: number, left: string, middle: string, right: string): string {
  return left + middle.repeat(width - 2) + right;
}

function padLine(content: string, width: number): string {
  const padding = width - 2 - content.length;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return '│' + ' '.repeat(leftPad) + content + ' '.repeat(rightPad) + '│';
}

export function renderReportHeader(options: ReportHeaderOptions): string {
  const { title, timezone, useColor = true } = options;

  const fullTitle = `${title} (Timezone: ${timezone})`;
  const boxWidth = getBoxWidth(fullTitle);

  const lines: string[] = [];

  // Top border
  const topBorder = drawBoxLine(boxWidth, '┌', '─', '┐');
  lines.push(useColor ? pc.gray(topBorder) : topBorder);

  // Title line
  const titleLine = padLine(fullTitle, boxWidth);
  lines.push(useColor ? pc.white(titleLine) : titleLine);

  // Bottom border
  const bottomBorder = drawBoxLine(boxWidth, '└', '─', '┘');
  lines.push(useColor ? pc.gray(bottomBorder) : bottomBorder);

  return lines.join('\n');
}
