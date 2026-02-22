import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { asRecord } from '../utils/as-record.js';
import { getUserCacheRootDir } from '../utils/cache-root-dir.js';
import { parseVersion } from './version-utils.js';

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 1000;

export const UPDATE_CHECK_CACHE_SCOPE_ENV_VAR = 'LLM_USAGE_UPDATE_CACHE_SCOPE';
export const UPDATE_CHECK_CACHE_SESSION_KEY_ENV_VAR = 'LLM_USAGE_UPDATE_CACHE_SESSION_KEY';

export type UpdateCheckCachePayload = {
  checkedAt: number;
  latestVersion: string;
};

export type ResolveLatestVersionOptions = {
  packageName: string;
  cacheFilePath?: string;
  cacheTtlMs?: number;
  fetchTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export function getDefaultUpdateCheckCachePath(): string {
  return path.join(getUserCacheRootDir(), 'llm-usage-metrics', 'update-check.json');
}

function sanitizeCachePathFragment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/gu, '_');
}

function toCacheSessionKey(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const sanitizedValue = sanitizeCachePathFragment(trimmedValue);
  return sanitizedValue || undefined;
}

export function getSessionScopedCachePath(
  baseCacheFilePath: string,
  env: NodeJS.ProcessEnv,
  options: { parentPid?: number } = {},
): string {
  const cacheScope = env[UPDATE_CHECK_CACHE_SCOPE_ENV_VAR]?.trim().toLowerCase();

  if (cacheScope !== 'session') {
    return baseCacheFilePath;
  }

  const parentPid = options.parentPid ?? process.ppid;
  const sessionKey =
    toCacheSessionKey(env[UPDATE_CHECK_CACHE_SESSION_KEY_ENV_VAR]) ?? `ppid-${parentPid}`;

  const parsedPath = path.parse(baseCacheFilePath);
  return path.join(parsedPath.dir, `${parsedPath.name}.${sessionKey}${parsedPath.ext}`);
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

function isValidVersion(value: string): boolean {
  return parseVersion(value) !== undefined;
}

export function isCacheFresh(
  payload: Pick<UpdateCheckCachePayload, 'checkedAt'>,
  cacheTtlMs: number,
  now: () => number,
): boolean {
  const nowTimestamp = now();

  if (payload.checkedAt > nowTimestamp) {
    return false;
  }

  return nowTimestamp - payload.checkedAt <= cacheTtlMs;
}

export async function readUpdateCheckCachePayload(
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

  if (checkedAt === undefined || !latestVersion || !isValidVersion(latestVersion)) {
    return undefined;
  }

  return {
    checkedAt,
    latestVersion,
  };
}

export async function writeUpdateCheckCachePayload(
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

  if (!version || !isValidVersion(version)) {
    return undefined;
  }

  return version;
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
    await writeUpdateCheckCachePayload(cacheFilePath, {
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

  const cachePayload = await readUpdateCheckCachePayload(cacheFilePath);

  if (cachePayload && isCacheFresh(cachePayload, cacheTtlMs, now)) {
    return cachePayload.latestVersion;
  }

  try {
    const latestVersion = await fetchLatestVersion(options.packageName, fetchImpl, fetchTimeoutMs);

    if (!latestVersion) {
      return await refreshStaleCache(cacheFilePath, cachePayload, now);
    }

    try {
      await writeUpdateCheckCachePayload(cacheFilePath, {
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
