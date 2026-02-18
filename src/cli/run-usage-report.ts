import type { UsageDiagnostics } from './usage-data-contracts.js';
import { buildUsageData } from './build-usage-data.js';
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

function emitDiagnosticsToLogger(diagnostics: UsageDiagnostics): void {
  const totalSessions = diagnostics.sessionStats.reduce(
    (sum, current) => sum + current.filesFound,
    0,
  );
  const totalEvents = diagnostics.sessionStats.reduce(
    (sum, current) => sum + current.eventsParsed,
    0,
  );

  if (totalSessions > 0) {
    logger.info(`Found ${totalSessions} session file(s) with ${totalEvents} event(s)`);

    for (const session of diagnostics.sessionStats) {
      const eventsLabel = session.eventsParsed === 1 ? 'event' : 'events';
      logger.dim(
        `  ${session.source}: ${session.filesFound} file(s), ${session.eventsParsed} ${eventsLabel}`,
      );
    }
  } else {
    logger.warn('No sessions found');
  }

  switch (diagnostics.pricingOrigin) {
    case 'offline-cache':
      logger.info('Using cached pricing (offline mode)');
      return;
    case 'cache':
      logger.info('Loaded pricing from cache');
      return;
    case 'network':
    case 'fallback':
      logger.info('Fetched pricing from LiteLLM');
      return;
    case 'none':
      return;
  }
}

export async function buildUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<string> {
  const usageData = await buildUsageData(granularity, options);
  const format = resolveReportFormat(options);

  if (format === 'terminal') {
    emitDiagnosticsToLogger(usageData.diagnostics);
  }

  return renderUsageReport(usageData, format, { granularity });
}

export async function runUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<void> {
  const output = await buildUsageReport(granularity, options);
  console.log(output);
}
