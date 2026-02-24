import { buildEfficiencyData } from './build-efficiency-data.js';
import { emitDiagnostics } from './emit-diagnostics.js';
import { warnIfTerminalTableOverflows } from './terminal-overflow-warning.js';
import type { EfficiencyCommandOptions, EfficiencyDiagnostics } from './usage-data-contracts.js';
import { formatEnvVarOverrides } from '../config/env-var-display.js';
import {
  renderEfficiencyReport,
  type EfficiencyReportFormat,
} from '../render/render-efficiency-report.js';
import { logger } from '../utils/logger.js';
import type { ReportGranularity } from '../utils/time-buckets.js';

type PreparedEfficiencyReport = {
  format: EfficiencyReportFormat;
  output: string;
  diagnostics: EfficiencyDiagnostics;
};

function validateOutputFormatOptions(options: EfficiencyCommandOptions): void {
  if (options.markdown && options.json) {
    throw new Error('Choose either --markdown or --json, not both');
  }
}

function resolveReportFormat(options: EfficiencyCommandOptions): EfficiencyReportFormat {
  if (options.json) {
    return 'json';
  }

  if (options.markdown) {
    return 'markdown';
  }

  return 'terminal';
}

async function prepareEfficiencyReport(
  granularity: ReportGranularity,
  options: EfficiencyCommandOptions,
): Promise<PreparedEfficiencyReport> {
  validateOutputFormatOptions(options);

  const efficiencyData = await buildEfficiencyData(granularity, options);
  const format = resolveReportFormat(options);

  return {
    format,
    diagnostics: efficiencyData.diagnostics,
    output: renderEfficiencyReport(efficiencyData, format, {
      granularity,
    }),
  };
}

export async function buildEfficiencyReport(
  granularity: ReportGranularity,
  options: EfficiencyCommandOptions,
): Promise<string> {
  const preparedReport = await prepareEfficiencyReport(granularity, options);
  return preparedReport.output;
}

export async function runEfficiencyReport(
  granularity: ReportGranularity,
  options: EfficiencyCommandOptions,
): Promise<void> {
  const preparedReport = await prepareEfficiencyReport(granularity, options);

  emitDiagnostics(preparedReport.diagnostics.usage, logger);
  const envVarOverrideLines = formatEnvVarOverrides(
    preparedReport.diagnostics.usage.activeEnvOverrides,
  );

  if (envVarOverrideLines.length > 0) {
    const [headerLine, ...envVarLines] = envVarOverrideLines;
    if (headerLine) {
      logger.info(headerLine);
    }
    for (const envVarLine of envVarLines) {
      logger.dim(envVarLine);
    }
  }

  const mergeModeLabel = preparedReport.diagnostics.includeMergeCommits
    ? 'including merge commits'
    : 'excluding merge commits';
  logger.info(
    `Git outcomes (${mergeModeLabel}): ${preparedReport.diagnostics.gitCommitCount} commit(s), +${preparedReport.diagnostics.gitLinesAdded}/-${preparedReport.diagnostics.gitLinesDeleted} lines (${preparedReport.diagnostics.repoDir})`,
  );
  logger.info(
    `Repo-attributed usage events: ${preparedReport.diagnostics.repoMatchedUsageEvents} matched, ${preparedReport.diagnostics.repoExcludedUsageEvents} excluded, ${preparedReport.diagnostics.repoUnattributedUsageEvents} unattributed`,
  );

  if (preparedReport.diagnostics.scopeNote) {
    logger.warn(preparedReport.diagnostics.scopeNote);
  }

  if (preparedReport.format === 'terminal') {
    warnIfTerminalTableOverflows(preparedReport.output, (message) => {
      logger.warn(message);
    });
  }

  console.log(preparedReport.output);
}
