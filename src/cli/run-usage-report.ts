import { buildUsageData } from './build-usage-data.js';
import { emitDiagnostics } from './emit-diagnostics.js';
import { renderUsageReport, type UsageReportFormat } from '../render/render-usage-report.js';
import { logger } from '../utils/logger.js';
import type { ReportGranularity } from '../utils/time-buckets.js';

export type ReportCommandOptions = {
  piDir?: string;
  codexDir?: string;
  source?: string | string[];
  since?: string;
  until?: string;
  timezone?: string;
  provider?: string;
  markdown?: boolean;
  json?: boolean;
  pricingUrl?: string;
  pricingOffline?: boolean;
};

function resolveReportFormat(options: ReportCommandOptions): UsageReportFormat {
  if (options.json) {
    return 'json';
  }

  if (options.markdown) {
    return 'markdown';
  }

  return 'terminal';
}

export async function buildUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<string> {
  const usageData = await buildUsageData(granularity, options);
  const format = resolveReportFormat(options);

  return renderUsageReport(usageData, format, { granularity });
}

export async function runUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<void> {
  const usageData = await buildUsageData(granularity, options);
  const format = resolveReportFormat(options);

  if (format === 'terminal') {
    emitDiagnostics(usageData.diagnostics, logger);
  }

  const output = renderUsageReport(usageData, format, { granularity });
  console.log(output);
}
