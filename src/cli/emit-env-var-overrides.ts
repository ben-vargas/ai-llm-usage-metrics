import { formatEnvVarOverrides, type EnvVarOverride } from '../config/env-var-display.js';

type EnvVarOverridesLogger = {
  info: (message: string) => void;
  dim: (message: string) => void;
};

export function emitEnvVarOverrides(
  activeEnvOverrides: EnvVarOverride[],
  diagnosticsLogger: EnvVarOverridesLogger,
): void {
  const envVarOverrideLines = formatEnvVarOverrides(activeEnvOverrides);

  if (envVarOverrideLines.length === 0) {
    return;
  }

  const [headerLine, ...envVarLines] = envVarOverrideLines;

  if (headerLine) {
    diagnosticsLogger.info(headerLine);
  }

  for (const envVarLine of envVarLines) {
    diagnosticsLogger.dim(envVarLine);
  }
}
