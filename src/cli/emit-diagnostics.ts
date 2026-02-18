import type { UsageDiagnostics } from './usage-data-contracts.js';
import { logger } from '../utils/logger.js';

export type DiagnosticsLogger = Pick<typeof logger, 'info' | 'warn' | 'dim'>;

export function emitDiagnostics(
  diagnostics: UsageDiagnostics,
  diagnosticsLogger: DiagnosticsLogger = logger,
): void {
  const totalSessions = diagnostics.sessionStats.reduce(
    (sum, current) => sum + current.filesFound,
    0,
  );
  const totalEvents = diagnostics.sessionStats.reduce(
    (sum, current) => sum + current.eventsParsed,
    0,
  );

  if (totalSessions > 0) {
    diagnosticsLogger.info(`Found ${totalSessions} session file(s) with ${totalEvents} event(s)`);

    for (const session of diagnostics.sessionStats) {
      const eventsLabel = session.eventsParsed === 1 ? 'event' : 'events';
      diagnosticsLogger.dim(
        `  ${session.source}: ${session.filesFound} file(s), ${session.eventsParsed} ${eventsLabel}`,
      );
    }
  } else {
    diagnosticsLogger.warn('No sessions found');
  }

  switch (diagnostics.pricingOrigin) {
    case 'offline-cache':
      diagnosticsLogger.info('Using cached pricing (offline mode)');
      return;
    case 'cache':
      diagnosticsLogger.info('Loaded pricing from cache');
      return;
    case 'network':
      diagnosticsLogger.info('Fetched pricing from LiteLLM');
      return;
    case 'fallback':
      diagnosticsLogger.warn('Using built-in pricing source');
      return;
    case 'none':
      return;
  }
}
