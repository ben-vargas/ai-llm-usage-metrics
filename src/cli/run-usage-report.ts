import { buildUsageData } from './build-usage-data.js';
import { emitDiagnostics } from './emit-diagnostics.js';
import { emitEnvVarOverrides } from './emit-env-var-overrides.js';
import type { ReportCommandOptions, UsageDiagnostics } from './usage-data-contracts.js';
import { warnIfTerminalTableOverflows } from './terminal-overflow-warning.js';
import { renderUsageReport, type UsageReportFormat } from '../render/render-usage-report.js';
import type { UsageTableLayout } from '../render/row-cells.js';
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

function resolveTableLayout(options: ReportCommandOptions): UsageTableLayout {
  return options.perModelColumns ? 'per_model_columns' : 'compact';
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
    output: renderUsageReport(usageData, format, {
      granularity,
      tableLayout: resolveTableLayout(options),
    }),
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
  emitDiagnostics(preparedReport.diagnostics, logger);
  emitEnvVarOverrides(preparedReport.diagnostics.activeEnvOverrides, logger);

  if (preparedReport.format === 'terminal') {
    warnIfTerminalTableOverflows(preparedReport.output, (message) => {
      logger.warn(message);
    });
  }

  console.log(preparedReport.output);
}
