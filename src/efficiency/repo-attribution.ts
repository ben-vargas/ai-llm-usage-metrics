import { access, constants } from 'node:fs/promises';
import path from 'node:path';

import type { UsageEvent } from '../domain/usage-event.js';

export type RepoAttributionResult = {
  matchedEvents: UsageEvent[];
  matchedEventCount: number;
  excludedEventCount: number;
  unattributedEventCount: number;
};

export type RepoRootResolver = (pathHint: string) => Promise<string | undefined>;

async function hasGitMarker(directoryPath: string): Promise<boolean> {
  try {
    await access(path.join(directoryPath, '.git'), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeComparablePath(value: string): string {
  const normalizedPath = path.normalize(path.resolve(value));
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;
}

export async function resolveRepoRootFromPathHint(pathHint: string): Promise<string | undefined> {
  const trimmedPath = pathHint.trim();

  if (!trimmedPath) {
    return undefined;
  }

  let currentPath = path.resolve(trimmedPath);

  for (;;) {
    if (await hasGitMarker(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      return undefined;
    }

    currentPath = parentPath;
  }
}

export async function attributeUsageEventsToRepo(
  events: UsageEvent[],
  repoDir: string,
  resolveRepoRoot: RepoRootResolver = resolveRepoRootFromPathHint,
): Promise<RepoAttributionResult> {
  const resolvedTargetRepoRoot = await resolveRepoRoot(repoDir).catch(() => undefined);
  const targetRepoPath = normalizeComparablePath(resolvedTargetRepoRoot ?? repoDir);
  const rootCache = new Map<string, Promise<string | undefined>>();
  const matchedEvents: UsageEvent[] = [];
  let excludedEventCount = 0;
  let unattributedEventCount = 0;

  for (const event of events) {
    if (!event.repoRoot) {
      unattributedEventCount += 1;
      continue;
    }

    const cachedRootPromise =
      rootCache.get(event.repoRoot) ?? resolveRepoRoot(event.repoRoot).catch(() => undefined);
    rootCache.set(event.repoRoot, cachedRootPromise);
    const resolvedRoot = await cachedRootPromise;

    if (!resolvedRoot) {
      unattributedEventCount += 1;
      continue;
    }

    if (normalizeComparablePath(resolvedRoot) !== targetRepoPath) {
      excludedEventCount += 1;
      continue;
    }

    matchedEvents.push({
      ...event,
      repoRoot: resolvedRoot,
    });
  }

  return {
    matchedEvents,
    matchedEventCount: matchedEvents.length,
    excludedEventCount,
    unattributedEventCount,
  };
}
