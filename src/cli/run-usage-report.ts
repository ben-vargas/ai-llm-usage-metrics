import { buildUsageData } from './build-usage-data.js';
import { emitDiagnostics } from './emit-diagnostics.js';
import type { ReportCommandOptions, UsageDiagnostics } from './usage-data-contracts.js';
import { renderUsageReport, type UsageReportFormat } from '../render/render-usage-report.js';
import { logger } from '../utils/logger.js';
import type { ReportGranularity } from '../utils/time-buckets.js';

type PreparedUsageReport = {
  format: UsageReportFormat;
  output: string;
  diagnostics: UsageDiagnostics;
};

function validateOutputFormatOptions(options: ReportCommandOptions): void {
  if (options.markdown && options.json) {
    throw new Error('Choose either --markdown or --json, not both');
  }
}

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
  validateOutputFormatOptions(options);

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
