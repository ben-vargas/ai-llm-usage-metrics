import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 1000;

export const UPDATE_CHECK_SKIP_ENV_VAR = 'LLM_USAGE_SKIP_UPDATE_CHECK';

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

type UpdateCheckCachePayload = {
  checkedAt: number;
  latestVersion: string;
};

type CommandRunnerOptions = {
  env?: NodeJS.ProcessEnv;
  stdio?: 'inherit';
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandRunnerOptions,
) => Promise<number>;

export type ResolveLatestVersionOptions = {
  packageName: string;
  cacheFilePath?: string;
  cacheTtlMs?: number;
  fetchTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type UpdateNotifierOptions = {
  packageName: string;
  currentVersion: string;
  cacheFilePath?: string;
  cacheTtlMs?: number;
  fetchTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
  argv?: string[];
  execPath?: string;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  confirmInstall?: (prompt: string) => Promise<boolean>;
  runCommand?: CommandRunner;
  notify?: (message: string) => void;
};

export type UpdateNotifierResult = {
  continueExecution: boolean;
  exitCode?: number;
};

function getCacheRootDir(): string {
  const xdgCacheDir = process.env.XDG_CACHE_HOME;

  if (xdgCacheDir) {
    return xdgCacheDir;
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;

    if (localAppData) {
      return localAppData;
    }
  }

  return path.join(os.homedir(), '.cache');
}

export function getDefaultUpdateCheckCachePath(): string {
  return path.join(getCacheRootDir(), 'llm-usage-metrics', 'update-check.json');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function parseVersion(value: string): ParsedVersion | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(
    value.trim(),
  );

  if (!match) {
    return undefined;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (![major, minor, patch].every((part) => Number.isSafeInteger(part))) {
    return undefined;
  }

  const prerelease = match[4] ? match[4].split('.') : [];

  return {
    major,
    minor,
    patch,
    prerelease,
  };
}

function isNumericIdentifier(value: string): boolean {
  return /^\d+$/u.test(value);
}

function comparePrereleaseIdentifiers(left: string, right: string): number {
  const leftIsNumeric = isNumericIdentifier(left);
  const rightIsNumeric = isNumericIdentifier(right);

  if (leftIsNumeric && rightIsNumeric) {
    return Number(left) - Number(right);
  }

  if (leftIsNumeric && !rightIsNumeric) {
    return -1;
  }

  if (!leftIsNumeric && rightIsNumeric) {
    return 1;
  }

  return left.localeCompare(right);
}

export function compareVersions(left: string, right: string): number {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);

  if (!parsedLeft || !parsedRight) {
    return 0;
  }

  if (parsedLeft.major !== parsedRight.major) {
    return parsedLeft.major - parsedRight.major;
  }

  if (parsedLeft.minor !== parsedRight.minor) {
    return parsedLeft.minor - parsedRight.minor;
  }

  if (parsedLeft.patch !== parsedRight.patch) {
    return parsedLeft.patch - parsedRight.patch;
  }

  const leftPrerelease = parsedLeft.prerelease;
  const rightPrerelease = parsedRight.prerelease;

  if (leftPrerelease.length === 0 && rightPrerelease.length === 0) {
    return 0;
  }

  if (leftPrerelease.length === 0) {
    return 1;
  }

  if (rightPrerelease.length === 0) {
    return -1;
  }

  const comparableLength = Math.min(leftPrerelease.length, rightPrerelease.length);

  for (let index = 0; index < comparableLength; index += 1) {
    const comparison = comparePrereleaseIdentifiers(leftPrerelease[index], rightPrerelease[index]);

    if (comparison !== 0) {
      return comparison;
    }
  }

  return leftPrerelease.length - rightPrerelease.length;
}

function isPrerelease(version: string): boolean {
  const parsed = parseVersion(version);
  return Boolean(parsed && parsed.prerelease.length > 0);
}

export function shouldOfferUpdate(currentVersion: string, latestVersion: string): boolean {
  if (isPrerelease(latestVersion) && !isPrerelease(currentVersion)) {
    return false;
  }

  return compareVersions(latestVersion, currentVersion) > 0;
}

export function isCacheFresh(
  payload: { checkedAt: number },
  cacheTtlMs: number,
  now: () => number,
): boolean {
  return now() - payload.checkedAt <= cacheTtlMs;
}

async function readCachePayload(
  cacheFilePath: string,
): Promise<UpdateCheckCachePayload | undefined> {
  let content: string;

  try {
    content = await readFile(cacheFilePath, 'utf8');
  } catch {
    return undefined;
  }

  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(content);
  } catch {
    return undefined;
  }

  const record = asRecord(parsedContent);

  if (!record) {
    return undefined;
  }

  const checkedAt = toNonNegativeNumber(record.checkedAt);
  const latestVersion = typeof record.latestVersion === 'string' ? record.latestVersion.trim() : '';

  if (checkedAt === undefined || !latestVersion) {
    return undefined;
  }

  return {
    checkedAt,
    latestVersion,
  };
}

async function writeCachePayload(
  cacheFilePath: string,
  payload: UpdateCheckCachePayload,
): Promise<void> {
  await mkdir(path.dirname(cacheFilePath), { recursive: true });
  await writeFile(cacheFilePath, JSON.stringify(payload), 'utf8');
}

async function fetchLatestVersion(
  packageName: string,
  fetchImpl: typeof fetch,
  fetchTimeoutMs: number,
): Promise<string | undefined> {
  const response = await fetchImpl(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
    {
      signal: AbortSignal.timeout(fetchTimeoutMs),
    },
  );

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as unknown;
  const payloadRecord = asRecord(payload);

  if (!payloadRecord) {
    return undefined;
  }

  const version = typeof payloadRecord.version === 'string' ? payloadRecord.version.trim() : '';

  return version || undefined;
}

async function refreshStaleCache(
  cacheFilePath: string,
  stalePayload: UpdateCheckCachePayload | undefined,
  now: () => number,
): Promise<string | undefined> {
  if (!stalePayload) {
    return undefined;
  }

  try {
    await writeCachePayload(cacheFilePath, {
      checkedAt: now(),
      latestVersion: stalePayload.latestVersion,
    });
  } catch {
    // Cache writes are best-effort.
  }

  return stalePayload.latestVersion;
}

export async function resolveLatestVersion(
  options: ResolveLatestVersionOptions,
): Promise<string | undefined> {
  const cacheFilePath = options.cacheFilePath ?? getDefaultUpdateCheckCachePath();
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  const cachePayload = await readCachePayload(cacheFilePath);

  if (cachePayload && isCacheFresh(cachePayload, cacheTtlMs, now)) {
    return cachePayload.latestVersion;
  }

  try {
    const latestVersion = await fetchLatestVersion(options.packageName, fetchImpl, fetchTimeoutMs);

    if (!latestVersion) {
      return await refreshStaleCache(cacheFilePath, cachePayload, now);
    }

    try {
      await writeCachePayload(cacheFilePath, {
        checkedAt: now(),
        latestVersion,
      });
    } catch {
      // Cache writes are best-effort.
    }

    return latestVersion;
  } catch {
    return await refreshStaleCache(cacheFilePath, cachePayload, now);
  }
}

function isInteractiveSession(options: {
  env: NodeJS.ProcessEnv;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}): boolean {
  return options.stdinIsTTY && options.stdoutIsTTY && !options.env.CI;
}

export function isLikelyNpxExecution(argv: string[], env: NodeJS.ProcessEnv): boolean {
  const executablePath = argv[1] ?? '';

  if (/[\\/]_npx[\\/]/u.test(executablePath)) {
    return true;
  }

  const npmExecPath = env.npm_execpath ?? '';

  if (/npx(?:-cli)?\.js$/u.test(npmExecPath) || /[\\/]npx[\\/]/u.test(npmExecPath)) {
    return true;
  }

  const npmCommand = env.npm_command ?? '';

  return npmCommand === 'exec';
}

async function defaultConfirmInstall(prompt: string): Promise<boolean> {
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

async function runCommandWithSpawn(
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

function defaultNotify(message: string): void {
  console.error(message);
}

export async function checkForUpdatesAndMaybeRestart(
  options: UpdateNotifierOptions,
): Promise<UpdateNotifierResult> {
  const env = options.env ?? process.env;

  if (env[UPDATE_CHECK_SKIP_ENV_VAR] === '1') {
    return { continueExecution: true };
  }

  try {
    const latestVersion = await resolveLatestVersion({
      packageName: options.packageName,
      cacheFilePath: options.cacheFilePath,
      cacheTtlMs: options.cacheTtlMs,
      fetchTimeoutMs: options.fetchTimeoutMs,
      fetchImpl: options.fetchImpl,
      now: options.now,
    });

    if (!latestVersion || !shouldOfferUpdate(options.currentVersion, latestVersion)) {
      return { continueExecution: true };
    }

    const notify = options.notify ?? defaultNotify;
    const updateMessage = `Update available for ${options.packageName}: ${options.currentVersion} → ${latestVersion}.`;

    const stdinIsTTY = options.stdinIsTTY ?? process.stdin.isTTY;
    const stdoutIsTTY = options.stdoutIsTTY ?? process.stdout.isTTY;
    const interactive = isInteractiveSession({ env, stdinIsTTY, stdoutIsTTY });
    const executedViaNpx = isLikelyNpxExecution(options.argv ?? process.argv, env);

    if (!interactive || executedViaNpx) {
      notify(`${updateMessage} Run "npm install -g ${options.packageName}@latest" to update.`);
      return { continueExecution: true };
    }

    const confirmInstall = options.confirmInstall ?? defaultConfirmInstall;
    const installAccepted = await confirmInstall(`${updateMessage} Install now? [y/N] `);

    if (!installAccepted) {
      return { continueExecution: true };
    }

    const runCommand = options.runCommand ?? runCommandWithSpawn;
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const installExitCode = await runCommand(
      npmCommand,
      ['install', '-g', `${options.packageName}@latest`],
      {
        env,
        stdio: 'inherit',
      },
    );

    if (installExitCode !== 0) {
      notify(`Failed to install ${options.packageName}@latest (exit code ${installExitCode}).`);
      return { continueExecution: true };
    }

    const argv = options.argv ?? process.argv;
    const restartArgs = argv.slice(1);
    const restartEnv: NodeJS.ProcessEnv = {
      ...env,
      [UPDATE_CHECK_SKIP_ENV_VAR]: '1',
    };

    const restartExitCode = await runCommand(options.execPath ?? process.execPath, restartArgs, {
      env: restartEnv,
      stdio: 'inherit',
    });

    return {
      continueExecution: false,
      exitCode: restartExitCode,
    };
  } catch {
    return { continueExecution: true };
  }
}
