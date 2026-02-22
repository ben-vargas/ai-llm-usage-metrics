const sqliteExperimentalWarningText =
  'SQLite is an experimental feature and might change at any time';

export function isSqliteExperimentalWarning(
  warning: unknown,
  warningType: string | undefined,
): boolean {
  const message =
    warning instanceof Error ? warning.message : typeof warning === 'string' ? warning : '';
  const derivedType =
    warningType ??
    (warning instanceof Error ? warning.name : typeof warning === 'string' ? '' : '');

  return derivedType === 'ExperimentalWarning' && message.includes(sqliteExperimentalWarningText);
}

export function withSuppressedSqliteExperimentalWarning<T>(load: () => T): T {
  const originalEmitWarning = process.emitWarning.bind(process);
  const patchedEmitWarning = ((warning: unknown, ...args: unknown[]): void => {
    const firstArgument = args[0];
    const warningType =
      typeof firstArgument === 'string'
        ? firstArgument
        : typeof firstArgument === 'object' &&
            firstArgument !== null &&
            'type' in firstArgument &&
            typeof firstArgument.type === 'string'
          ? firstArgument.type
          : undefined;

    if (isSqliteExperimentalWarning(warning, warningType)) {
      return;
    }

    Reflect.apply(originalEmitWarning, process, [warning, ...args]);
  }) as typeof process.emitWarning;

  process.emitWarning = patchedEmitWarning;

  try {
    return load();
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}
