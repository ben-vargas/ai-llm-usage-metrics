import { CodexSourceAdapter } from './codex/codex-source-adapter.js';
import { OpenCodeSourceAdapter } from './opencode/opencode-source-adapter.js';
import { PiSourceAdapter } from './pi/pi-source-adapter.js';
import type { SourceAdapter } from './source-adapter.js';

type SourceRegistration = {
  id: string;
  create: (
    options: CreateDefaultAdaptersOptions,
    sourceDirectoryOverrides: ReadonlyMap<string, string>,
  ) => SourceAdapter;
};

export type CreateDefaultAdaptersOptions = {
  piDir?: string;
  codexDir?: string;
  opencodeDb?: string;
  sourceDir?: string[];
};

const DIRECTORY_SOURCE_IDS = ['pi', 'codex'] as const;

const NON_DIRECTORY_SOURCE_FLAGS = new Map<string, string>([['opencode', '--opencode-db']]);

function parseSourceDirectoryOverrides(entries: string[] | undefined): Map<string, string> {
  const overrides = new Map<string, string>();

  if (!entries || entries.length === 0) {
    return overrides;
  }

  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=');

    if (separatorIndex <= 0 || separatorIndex >= entry.length - 1) {
      throw new Error('--source-dir must use format <source-id>=<path>');
    }

    const sourceId = entry.slice(0, separatorIndex).trim().toLowerCase();
    const directoryPath = entry.slice(separatorIndex + 1).trim();

    if (!sourceId || !directoryPath) {
      throw new Error('--source-dir must use non-empty <source-id>=<path> values');
    }

    if (overrides.has(sourceId)) {
      throw new Error(`Duplicate --source-dir source id: ${sourceId}`);
    }

    overrides.set(sourceId, directoryPath);
  }

  return overrides;
}

const sourceRegistrations: readonly SourceRegistration[] = [
  {
    id: 'pi',
    create: (options, sourceDirectoryOverrides) =>
      new PiSourceAdapter({
        sessionsDir: resolveDirectoryOverride('pi', options.piDir, sourceDirectoryOverrides),
      }),
  },
  {
    id: 'codex',
    create: (options, sourceDirectoryOverrides) =>
      new CodexSourceAdapter({
        sessionsDir: resolveDirectoryOverride('codex', options.codexDir, sourceDirectoryOverrides),
      }),
  },
  {
    id: 'opencode',
    create: (options) =>
      new OpenCodeSourceAdapter({
        dbPath: options.opencodeDb,
      }),
  },
];

function validateSourceDirectoryOverrideIds(
  sourceDirectoryOverrides: ReadonlyMap<string, string>,
): void {
  const nonDirectorySourceOverrides = [...sourceDirectoryOverrides.keys()].filter((sourceId) =>
    NON_DIRECTORY_SOURCE_FLAGS.has(sourceId),
  );

  if (nonDirectorySourceOverrides.length > 0) {
    const sourceId = nonDirectorySourceOverrides[0];
    const flag = NON_DIRECTORY_SOURCE_FLAGS.get(sourceId);

    throw new Error(`--source-dir does not support "${sourceId}". Use ${flag} instead.`);
  }

  const directorySourceIds = new Set<string>(DIRECTORY_SOURCE_IDS);
  const unknownSourceIds = [...sourceDirectoryOverrides.keys()].filter(
    (sourceId) => !directorySourceIds.has(sourceId),
  );

  if (unknownSourceIds.length === 0) {
    return;
  }

  const allowedSourceIds = [...directorySourceIds].sort((left, right) => left.localeCompare(right));

  throw new Error(
    `Unknown --source-dir source id(s): ${unknownSourceIds.join(', ')}. Allowed values: ${allowedSourceIds.join(', ')}`,
  );
}

function validateOpencodeOverride(opencodeDb: string | undefined): void {
  if (opencodeDb === undefined) {
    return;
  }

  if (opencodeDb.trim().length === 0) {
    throw new Error('--opencode-db must be a non-empty path');
  }
}

function resolveDirectoryOverride(
  sourceId: string,
  explicitDirectory: string | undefined,
  sourceDirectoryOverrides: ReadonlyMap<string, string>,
): string | undefined {
  return explicitDirectory ?? sourceDirectoryOverrides.get(sourceId);
}

export function getDefaultSourceIds(): string[] {
  return sourceRegistrations.map((source) => source.id);
}

export function createDefaultAdapters(options: CreateDefaultAdaptersOptions): SourceAdapter[] {
  validateOpencodeOverride(options.opencodeDb);

  const sourceDirectoryOverrides = parseSourceDirectoryOverrides(options.sourceDir);
  validateSourceDirectoryOverrideIds(sourceDirectoryOverrides);

  return sourceRegistrations.map((source) => source.create(options, sourceDirectoryOverrides));
}
