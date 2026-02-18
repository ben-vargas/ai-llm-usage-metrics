import { formatEnvVarOverrides } from '../config/env-var-display.js';
import type { UsageDataResult } from '../cli/usage-data-contracts.js';
import type { ReportGranularity } from '../utils/time-buckets.js';
import { renderMarkdownTable } from './markdown-table.js';
import { renderReportHeader } from './report-header.js';
import { renderTerminalTable, shouldUseColorByDefault } from './terminal-table.js';

export type UsageReportFormat = 'terminal' | 'markdown' | 'json';

export type RenderUsageReportOptions = {
  granularity: ReportGranularity;
  useColor?: boolean;
};

function getReportTitle(granularity: ReportGranularity): string {
  switch (granularity) {
    case 'daily':
      return 'Daily Token Usage Report';
    case 'weekly':
      return 'Weekly Token Usage Report';
    case 'monthly':
      return 'Monthly Token Usage Report';
  }
}

function renderTerminalUsageReport(
  usageData: UsageDataResult,
  options: RenderUsageReportOptions,
): string {
  const outputLines: string[] = [];
  const envVarOverrideLines = formatEnvVarOverrides(usageData.diagnostics.activeEnvOverrides);
  const useColor = options.useColor ?? shouldUseColorByDefault();

  if (envVarOverrideLines.length > 0) {
    outputLines.push(...envVarOverrideLines);
    outputLines.push('');
  }

  outputLines.push(
    renderReportHeader({
      title: getReportTitle(options.granularity),
      timezone: usageData.diagnostics.timezone,
      useColor,
    }),
  );

  outputLines.push('');
  outputLines.push(renderTerminalTable(usageData.rows, { useColor }));

  return outputLines.join('\n');
}

export function renderUsageReport(
  usageData: UsageDataResult,
  format: UsageReportFormat,
  options: RenderUsageReportOptions,
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(usageData.rows, null, 2);
    case 'markdown':
      return renderMarkdownTable(usageData.rows);
    case 'terminal':
      return renderTerminalUsageReport(usageData, options);
  }
}
