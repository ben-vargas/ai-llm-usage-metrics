import { createRequire } from 'node:module';

import { withSuppressedSqliteExperimentalWarning } from './sqlite-warning-suppression.js';

export type SqliteModule = {
  DatabaseSync: new (
    filePath: string,
    options?: {
      readOnly?: boolean;
      timeout?: number;
    },
  ) => {
    prepare: (sql: string) => {
      all: (...anonymousParameters: unknown[]) => Record<string, unknown>[];
    };
    close: () => void;
  };
};

type RequireFn = (moduleId: string) => unknown;

const require = createRequire(import.meta.url);

export function loadNodeSqliteModuleFromRequire(requireFn: RequireFn): SqliteModule {
  try {
    return withSuppressedSqliteExperimentalWarning(() => requireFn('node:sqlite') as SqliteModule);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `OpenCode source requires Node.js 24+ runtime with node:sqlite support: ${reason}`,
    );
  }
}

export async function loadNodeSqliteModule(): Promise<SqliteModule> {
  return loadNodeSqliteModuleFromRequire(require);
}
