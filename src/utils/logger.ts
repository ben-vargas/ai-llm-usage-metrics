import pc from 'picocolors';

type LogLevel = 'info' | 'warn' | 'dim';

const icons: Record<LogLevel, string> = {
  info: pc.blue('ℹ'),
  warn: pc.yellow('⚠'),
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
  dim: (message: string): void => {
    console.error(formatMessage('dim', message));
  },
};
