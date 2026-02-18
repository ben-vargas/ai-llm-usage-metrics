import pc from 'picocolors';

type LogLevel = 'info' | 'warn' | 'success' | 'dim';

const icons: Record<LogLevel, string> = {
  info: pc.blue('ℹ'),
  warn: pc.yellow('⚠'),
  success: pc.green('✔'),
  dim: pc.gray('•'),
};

function formatMessage(level: LogLevel, message: string): string {
  const icon = icons[level];
  return `${icon} ${message}`;
}

export const logger = {
  info: (message: string): void => {
    console.error(formatMessage('info', message));
  },
  warn: (message: string): void => {
    console.error(formatMessage('warn', message));
  },
  success: (message: string): void => {
    console.error(formatMessage('success', message));
  },
  dim: (message: string): void => {
    console.error(formatMessage('dim', pc.gray(message)));
  },
  group: (title: string): void => {
    console.error(pc.bold(title));
  },
};

export type SessionInfo = {
  source: string;
  sessionsFound: number;
  eventsParsed: number;
};

export function logSessionSummary(sessions: SessionInfo[]): void {
  if (sessions.length === 0) {
    logger.warn('No sessions found');
    return;
  }

  const totalSessions = sessions.reduce((sum, s) => sum + s.sessionsFound, 0);
  const totalEvents = sessions.reduce((sum, s) => sum + s.eventsParsed, 0);

  logger.info(`Found ${totalSessions} session file(s) with ${totalEvents} event(s)`);

  for (const session of sessions) {
    const eventsLabel = session.eventsParsed === 1 ? 'event' : 'events';
    logger.dim(
      `  ${session.source}: ${session.sessionsFound} file(s), ${session.eventsParsed} ${eventsLabel}`,
    );
  }
}
