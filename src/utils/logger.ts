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
    console.error(formatMessage('dim', message));
  },
};
