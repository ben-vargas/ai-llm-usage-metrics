import pc from 'picocolors';

export type ReportHeaderOptions = {
  title: string;
  subtitle?: string;
  timezone: string;
  useColor?: boolean;
};

function getBoxWidth(title: string, subtitle: string | undefined): number {
  const contentWidth = Math.max(title.length, subtitle?.length ?? 0);
  return contentWidth + 4; // 2 spaces padding on each side
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
  const { title, subtitle, timezone, useColor = true } = options;

  const fullTitle = `${title} (Timezone: ${timezone})`;
  const boxWidth = getBoxWidth(fullTitle, subtitle);

  const lines: string[] = [];

  // Top border
  const topBorder = drawBoxLine(boxWidth, '┌', '─', '┐');
  lines.push(useColor ? pc.gray(topBorder) : topBorder);

  // Title line
  const titleLine = padLine(fullTitle, boxWidth);
  lines.push(useColor ? pc.white(titleLine) : titleLine);

  // Subtitle line (if provided)
  if (subtitle) {
    const subtitleLine = padLine(subtitle, boxWidth);
    lines.push(useColor ? pc.dim(subtitleLine) : subtitleLine);
  }

  // Bottom border
  const bottomBorder = drawBoxLine(boxWidth, '└', '─', '┘');
  lines.push(useColor ? pc.gray(bottomBorder) : bottomBorder);

  return lines.join('\n');
}
