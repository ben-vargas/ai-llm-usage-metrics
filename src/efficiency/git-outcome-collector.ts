import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';

import { getPeriodKey, type ReportGranularity } from '../utils/time-buckets.js';
import {
  createEmptyEfficiencyOutcomeTotals,
  type EfficiencyOutcomeTotals,
} from './efficiency-row.js';

const GIT_COMMIT_MARKER = '\u001f';
const SHORTSTAT_PATTERN =
  /(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/u;

export type GitOutcomeCollectorOptions = {
  repoDir?: string;
  granularity: ReportGranularity;
  timezone: string;
  since?: string;
  until?: string;
  includeMergeCommits?: boolean;
  activeUsageDays?: ReadonlySet<string>;
};

export type GitOutcomeEvent = {
  sha: string;
  timestamp: string;
  linesAdded: number;
  linesDeleted: number;
  linesChanged: number;
};

export type GitOutcomeCollectionDiagnostics = {
  repoDir: string;
  includeMergeCommits: boolean;
  commitsCollected: number;
  linesAdded: number;
  linesDeleted: number;
};

export type GitOutcomeCollectionResult = {
  periodOutcomes: Map<string, EfficiencyOutcomeTotals>;
  totalOutcomes: EfficiencyOutcomeTotals;
  diagnostics: GitOutcomeCollectionDiagnostics;
};

type MutableGitOutcomeEvent = {
  sha: string;
  timestampSeconds: number;
  authorEmail: string;
  linesAdded: number;
  linesDeleted: number;
};

type GitCommandResult = {
  lines: string[];
  stderr: string;
  exitCode: number;
};

export type GitOutcomeCollectorDeps = {
  runGitCommand?: (repoDir: string, args: string[]) => Promise<GitCommandResult>;
};

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeGitRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function resolveGitCommandFailureReason(result: GitCommandResult): string {
  return result.stderr.trim() || `git exited with code ${result.exitCode}`;
}

async function resolveConfiguredAuthorEmail(
  repoDir: string,
  runCommand: (repoDir: string, args: string[]) => Promise<GitCommandResult>,
): Promise<string> {
  const gitConfigResult = await runCommand(repoDir, ['config', '--get', 'user.email']);

  if (gitConfigResult.exitCode !== 0) {
    if (gitConfigResult.exitCode === 1) {
      throw new Error(
        `Git user.email is not configured for ${repoDir}. Run: git -C ${repoDir} config user.email "you@example.com"`,
      );
    }

    const reason = resolveGitCommandFailureReason(gitConfigResult);
    throw new Error(`Failed to resolve git user.email from ${repoDir}: ${reason}`);
  }

  const configuredEmail = gitConfigResult.lines
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!configuredEmail) {
    throw new Error(`Git user.email is not configured for ${repoDir}`);
  }

  return configuredEmail;
}

function toIsoTimestamp(timestampSeconds: number): string {
  const timestamp = new Date(timestampSeconds * 1000);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Invalid git commit timestamp: ${timestampSeconds}`);
  }

  return timestamp.toISOString();
}

function parseShortstatLine(
  line: string,
): { linesAdded: number; linesDeleted: number } | undefined {
  const shortstatMatch = SHORTSTAT_PATTERN.exec(line.trim());

  if (!shortstatMatch) {
    return undefined;
  }

  const linesAddedRaw = shortstatMatch[2];
  const linesDeletedRaw = shortstatMatch[3];

  return {
    linesAdded: linesAddedRaw ? Number.parseInt(linesAddedRaw, 10) : 0,
    linesDeleted: linesDeletedRaw ? Number.parseInt(linesDeletedRaw, 10) : 0,
  };
}

function finalizeCurrentEvent(
  currentEvent: MutableGitOutcomeEvent | undefined,
  events: GitOutcomeEvent[],
  authorEmail: string | undefined,
): void {
  if (!currentEvent) {
    return;
  }

  if (
    authorEmail &&
    currentEvent.authorEmail.trim().toLowerCase() !== authorEmail.trim().toLowerCase()
  ) {
    return;
  }

  const timestamp = toIsoTimestamp(currentEvent.timestampSeconds);

  events.push({
    sha: currentEvent.sha,
    timestamp,
    linesAdded: currentEvent.linesAdded,
    linesDeleted: currentEvent.linesDeleted,
    linesChanged: currentEvent.linesAdded + currentEvent.linesDeleted,
  });
}

export function parseGitLogShortstatLines(
  lines: Iterable<string>,
  authorEmail?: string,
): GitOutcomeEvent[] {
  const events: GitOutcomeEvent[] = [];
  let currentEvent: MutableGitOutcomeEvent | undefined;

  for (const line of lines) {
    if (line.startsWith(GIT_COMMIT_MARKER)) {
      const commitParts = line.slice(1).split(GIT_COMMIT_MARKER);
      const timestampPart = commitParts[0];
      const shaPart = commitParts[1];
      const authorPart = commitParts[2];

      if (
        commitParts.length !== 3 ||
        !/^\d+$/u.test(timestampPart) ||
        !/^[0-9a-f]{7,64}$/iu.test(shaPart) ||
        authorPart.trim().length === 0
      ) {
        throw new Error(`Malformed git commit boundary line: ${line}`);
      }

      finalizeCurrentEvent(currentEvent, events, authorEmail);
      currentEvent = {
        timestampSeconds: Number.parseInt(timestampPart, 10),
        sha: shaPart,
        authorEmail: authorPart,
        linesAdded: 0,
        linesDeleted: 0,
      };
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    const shortstat = parseShortstatLine(line);

    if (!shortstat) {
      continue;
    }

    currentEvent.linesAdded += shortstat.linesAdded;
    currentEvent.linesDeleted += shortstat.linesDeleted;
  }

  finalizeCurrentEvent(currentEvent, events, authorEmail);
  return events;
}

async function runGitCommand(repoDir: string, args: string[]): Promise<GitCommandResult> {
  return await new Promise<GitCommandResult>((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: repoDir,
      env: {
        ...process.env,
        LC_ALL: 'C',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const lines: string[] = [];
    let stderr = '';

    const stdoutReader = createInterface({ input: child.stdout });
    const stdoutPromise = (async () => {
      for await (const line of stdoutReader) {
        lines.push(line);
      }
    })();

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (exitCode) => {
      void stdoutPromise
        .then(() => {
          resolve({
            lines,
            stderr,
            exitCode: exitCode ?? 1,
          });
        })
        .catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  });
}

function filterEventsByDateRange(
  events: GitOutcomeEvent[],
  timezone: string,
  since: string | undefined,
  until: string | undefined,
): GitOutcomeEvent[] {
  return events.filter((event) => {
    const eventDate = getPeriodKey(event.timestamp, 'daily', timezone);

    if (since && eventDate < since) {
      return false;
    }

    if (until && eventDate > until) {
      return false;
    }

    return true;
  });
}

function filterEventsByActiveUsageDays(
  events: GitOutcomeEvent[],
  timezone: string,
  activeUsageDays: ReadonlySet<string> | undefined,
): GitOutcomeEvent[] {
  if (activeUsageDays === undefined) {
    return events;
  }

  if (activeUsageDays.size === 0) {
    return [];
  }

  return events.filter((event) =>
    activeUsageDays.has(getPeriodKey(event.timestamp, 'daily', timezone)),
  );
}

function aggregatePeriodOutcomes(
  events: GitOutcomeEvent[],
  granularity: ReportGranularity,
  timezone: string,
): {
  periodOutcomes: Map<string, EfficiencyOutcomeTotals>;
  totalOutcomes: EfficiencyOutcomeTotals;
} {
  const periodOutcomes = new Map<string, EfficiencyOutcomeTotals>();
  const totalOutcomes = createEmptyEfficiencyOutcomeTotals();

  for (const event of events) {
    const periodKey = getPeriodKey(event.timestamp, granularity, timezone);
    const periodTotals = periodOutcomes.get(periodKey) ?? createEmptyEfficiencyOutcomeTotals();

    periodTotals.commitCount += 1;
    periodTotals.linesAdded += event.linesAdded;
    periodTotals.linesDeleted += event.linesDeleted;
    periodTotals.linesChanged += event.linesChanged;

    periodOutcomes.set(periodKey, periodTotals);

    totalOutcomes.commitCount += 1;
    totalOutcomes.linesAdded += event.linesAdded;
    totalOutcomes.linesDeleted += event.linesDeleted;
    totalOutcomes.linesChanged += event.linesChanged;
  }

  return {
    periodOutcomes,
    totalOutcomes,
  };
}

function buildGitLogArgs(options: {
  since?: string;
  until?: string;
  includeMergeCommits: boolean;
  authorEmail: string;
}): string[] {
  const args = [
    'log',
    `--pretty=format:${GIT_COMMIT_MARKER}%ct${GIT_COMMIT_MARKER}%H${GIT_COMMIT_MARKER}%ae`,
    '--shortstat',
    '--regexp-ignore-case',
    `--author=<${escapeGitRegexLiteral(options.authorEmail)}>`,
  ];

  if (!options.includeMergeCommits) {
    args.push('--no-merges');
  }

  if (options.since) {
    args.push(`--since=${shiftDate(options.since, -1)}T00:00:00Z`);
  }

  if (options.until) {
    args.push(`--until=${shiftDate(options.until, 1)}T23:59:59Z`);
  }

  return args;
}

export async function collectGitOutcomes(
  options: GitOutcomeCollectorOptions,
  deps: GitOutcomeCollectorDeps = {},
): Promise<GitOutcomeCollectionResult> {
  const repoDir = path.resolve(options.repoDir ?? process.cwd());
  const includeMergeCommits = options.includeMergeCommits ?? false;
  const runCommand = deps.runGitCommand ?? runGitCommand;
  const authorEmail = await resolveConfiguredAuthorEmail(repoDir, runCommand);

  const gitResult = await runCommand(
    repoDir,
    buildGitLogArgs({
      since: options.since,
      until: options.until,
      includeMergeCommits,
      authorEmail,
    }),
  );

  if (gitResult.exitCode !== 0) {
    const reason = resolveGitCommandFailureReason(gitResult);
    throw new Error(`Failed to collect git outcomes from ${repoDir}: ${reason}`);
  }

  const allEvents = parseGitLogShortstatLines(gitResult.lines, authorEmail);
  const filteredEvents = filterEventsByDateRange(
    allEvents,
    options.timezone,
    options.since,
    options.until,
  );
  const usageAttributedEvents = filterEventsByActiveUsageDays(
    filteredEvents,
    options.timezone,
    options.activeUsageDays,
  );
  const { periodOutcomes, totalOutcomes } = aggregatePeriodOutcomes(
    usageAttributedEvents,
    options.granularity,
    options.timezone,
  );

  return {
    periodOutcomes,
    totalOutcomes,
    diagnostics: {
      repoDir,
      includeMergeCommits,
      commitsCollected: totalOutcomes.commitCount,
      linesAdded: totalOutcomes.linesAdded,
      linesDeleted: totalOutcomes.linesDeleted,
    },
  };
}
