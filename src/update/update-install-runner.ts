import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

type CommandRunnerOptions = {
  env?: NodeJS.ProcessEnv;
  stdio?: 'inherit';
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandRunnerOptions,
) => Promise<number>;

export type ConfirmInstall = (prompt: string) => Promise<boolean>;
export type Notify = (message: string) => void;

export type UpdateInstallRestartResult = {
  continueExecution: boolean;
  exitCode?: number;
};

export type RunInteractiveInstallAndRestartOptions = {
  packageName: string;
  updateMessage: string;
  env: NodeJS.ProcessEnv;
  argv: string[];
  execPath?: string;
  skipUpdateCheckEnvVar: string;
  confirmInstall?: ConfirmInstall;
  runCommand?: CommandRunner;
  notify?: Notify;
};

export function isInteractiveSession(options: {
  env: NodeJS.ProcessEnv;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}): boolean {
  const ciValue = options.env.CI;
  const normalizedCiValue = ciValue?.trim().toLowerCase();
  const ciEnabled =
    normalizedCiValue !== undefined &&
    normalizedCiValue.length > 0 &&
    !['0', 'false', 'no', 'off'].includes(normalizedCiValue);

  return options.stdinIsTTY && options.stdoutIsTTY && !ciEnabled;
}

export async function defaultConfirmInstall(prompt: string): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question(prompt);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    readline.close();
  }
}

export async function runCommandWithSpawn(
  command: string,
  args: string[],
  options: CommandRunnerOptions = {},
): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env,
      stdio: options.stdio ?? 'inherit',
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (exitCode) => {
      resolve(exitCode ?? 1);
    });
  });
}

export function defaultNotify(message: string): void {
  console.error(message);
}

export async function runInteractiveInstallAndRestart(
  options: RunInteractiveInstallAndRestartOptions,
): Promise<UpdateInstallRestartResult> {
  const confirmInstall = options.confirmInstall ?? defaultConfirmInstall;
  const installAccepted = await confirmInstall(`${options.updateMessage} Install now? [y/N] `);

  if (!installAccepted) {
    return { continueExecution: true };
  }

  const runCommand = options.runCommand ?? runCommandWithSpawn;
  const notify = options.notify ?? defaultNotify;
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const installExitCode = await runCommand(
    npmCommand,
    ['install', '-g', `${options.packageName}@latest`],
    {
      env: options.env,
      stdio: 'inherit',
    },
  );

  if (installExitCode !== 0) {
    notify(`Failed to install ${options.packageName}@latest (exit code ${installExitCode}).`);
    return { continueExecution: true };
  }

  const restartArgs = options.argv.slice(1);
  const restartEnv: NodeJS.ProcessEnv = {
    ...options.env,
    [options.skipUpdateCheckEnvVar]: '1',
  };

  const restartExitCode = await runCommand(options.execPath ?? process.execPath, restartArgs, {
    env: restartEnv,
    stdio: 'inherit',
  });

  return {
    continueExecution: false,
    exitCode: restartExitCode,
  };
}
