import pc from 'picocolors';

export type ReportHeaderOptions = {
  title: string;
  timezone: string;
  useColor?: boolean;
};

function getBoxWidth(content: string): number {
  return content.length + 4;
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

  const topBorder = drawBoxLine(boxWidth, '┌', '─', '┐');
  lines.push(useColor ? pc.gray(topBorder) : topBorder);

  const titleLine = padLine(fullTitle, boxWidth);
  lines.push(useColor ? pc.white(titleLine) : titleLine);

  const bottomBorder = drawBoxLine(boxWidth, '└', '─', '┘');
  lines.push(useColor ? pc.gray(bottomBorder) : bottomBorder);

  return lines.join('\n');
}
