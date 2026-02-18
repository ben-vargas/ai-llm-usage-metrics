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

type PreparedUsageReport = {
  format: UsageReportFormat;
  output: string;
  diagnostics: Awaited<ReturnType<typeof buildUsageData>>['diagnostics'];
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

async function prepareUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<PreparedUsageReport> {
  const usageData = await buildUsageData(granularity, options);
  const format = resolveReportFormat(options);

  return {
    format,
    diagnostics: usageData.diagnostics,
    output: renderUsageReport(usageData, format, { granularity }),
  };
}

export async function buildUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<string> {
  const preparedReport = await prepareUsageReport(granularity, options);
  return preparedReport.output;
}

export async function runUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<void> {
  const preparedReport = await prepareUsageReport(granularity, options);

  if (preparedReport.format === 'terminal') {
    emitDiagnostics(preparedReport.diagnostics, logger);
  }

  console.log(preparedReport.output);
}
