import { describe, expect, it, vi } from 'vitest';

import { OpenCodeSourceAdapter } from '../../src/sources/opencode/opencode-source-adapter.js';

type FakeSqliteScenario = {
  tables?: string[];
  messageColumns?: string[];
  primaryRows?: Record<string, unknown>[];
  fallbackRows?: Record<string, unknown>[];
  primaryQueryErrors?: Error[];
  openErrors?: Error[];
  seenQueries?: string[];
};

type TestSqliteModule = {
  DatabaseSync: new (
    filePath: string,
    options?: {
      readOnly?: boolean;
      timeout?: number;
    },
  ) => {
    prepare: (sql: string) => { all: () => Record<string, unknown>[] };
    close: () => void;
  };
};

function createBusyError(message = 'database is locked'): Error {
  const error = new Error(message) as Error & { code?: string };
  error.code = 'SQLITE_BUSY';
  return error;
}

function createSqliteLoader(scenario: FakeSqliteScenario): () => Promise<TestSqliteModule> {
  class FakeDatabase {
    public constructor(
      filePath: string,
      options?: {
        readOnly?: boolean;
        timeout?: number;
      },
    ) {
      void filePath;
      void options;
      const openError = scenario.openErrors?.shift();

      if (openError) {
        throw openError;
      }
    }

    public prepare(sql: string): { all: () => Record<string, unknown>[] } {
      scenario.seenQueries?.push(sql);

      if (sql.includes('sqlite_master')) {
        const tables = scenario.tables ?? ['message'];
        return {
          all: () => tables.map((name) => ({ name })),
        };
      }

      if (sql.includes("PRAGMA table_info('message')")) {
        const columns = scenario.messageColumns ?? ['id', 'time_created', 'session_id', 'data'];
        return {
          all: () => columns.map((name) => ({ name })),
        };
      }

      if (sql.includes('WHERE json_extract')) {
        const queryError = scenario.primaryQueryErrors?.shift();

        if (queryError) {
          throw queryError;
        }

        return {
          all: () => scenario.primaryRows ?? [],
        };
      }

      return {
        all: () => scenario.fallbackRows ?? [],
      };
    }

    public close(): void {
      // no-op in fake sqlite database
    }
  }

  return async () => ({ DatabaseSync: FakeDatabase });
}

describe('OpenCodeSourceAdapter', () => {
  it('fails discovery when explicit --opencode-db path is missing or unreadable', async () => {
    const adapter = new OpenCodeSourceAdapter({
      dbPath: '/tmp/missing-opencode.db',
      pathReadable: async () => false,
    });

    await expect(adapter.discoverFiles()).rejects.toThrow(
      'OpenCode DB path is missing or unreadable: /tmp/missing-opencode.db',
    );
  });

  it('resolves default DB path deterministically when no explicit override is set', async () => {
    const adapter = new OpenCodeSourceAdapter({
      resolveDefaultDbPaths: () => ['/tmp/opencode-a.db', '/tmp/opencode-b.db'],
      pathExists: async (filePath) => filePath === '/tmp/opencode-b.db',
    });

    await expect(adapter.discoverFiles()).resolves.toEqual(['/tmp/opencode-b.db']);
  });

  it('maps assistant rows into normalized usage events and skips malformed rows', async () => {
    const adapter = new OpenCodeSourceAdapter({
      pathReadable: async () => true,
      loadSqliteModule: createSqliteLoader({
        primaryRows: [
          {
            row_id: 'msg-1',
            row_session_id: 'session-1',
            row_time: 1_737_000_000,
            data_json: JSON.stringify({
              role: 'assistant',
              providerID: 'openai',
              modelID: 'gpt-5-codex',
              tokens: {
                input: 100,
                output: 40,
                reasoning: 5,
                cache: { read: 20, write: 10 },
                total: 175,
              },
              cost: 1.5,
            }),
          },
          {
            row_id: 'msg-2',
            row_session_id: 'session-2',
            row_time: 1_737_000_001,
            data_json: '{invalid',
          },
          {
            row_id: 'msg-3',
            row_session_id: 'session-3',
            row_time: 1_737_000_002,
            data_json: JSON.stringify({ role: 'assistant', modelID: 'gpt-4.1' }),
          },
          {
            row_id: 'msg-4',
            row_session_id: 'session-4',
            row_time: 1_737_000_003,
            data_json: JSON.stringify({ role: 'user', tokens: { input: 1 } }),
          },
        ],
      }),
    });

    const events = await adapter.parseFile('/tmp/opencode.db');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: 'opencode',
      sessionId: 'session-1',
      timestamp: new Date(1_737_000_000 * 1000).toISOString(),
      provider: 'openai',
      model: 'gpt-5-codex',
      inputTokens: 100,
      outputTokens: 40,
      reasoningTokens: 5,
      cacheReadTokens: 20,
      cacheWriteTokens: 10,
      totalTokens: 175,
      costUsd: 1.5,
      costMode: 'explicit',
    });
  });

  it('falls back to non-json_extract query shape and filters assistant role in JS', async () => {
    const seenQueries: string[] = [];
    const adapter = new OpenCodeSourceAdapter({
      pathReadable: async () => true,
      loadSqliteModule: createSqliteLoader({
        primaryQueryErrors: [new Error('no such function: json_extract')],
        fallbackRows: [
          {
            row_id: 'msg-1',
            row_session_id: 'session-1',
            row_time: 1_737_000_000_000,
            data_json: JSON.stringify({
              role: 'assistant',
              provider: 'anthropic',
              model: 'claude-sonnet-4.5',
              tokens: { input: 10, output: 20 },
            }),
          },
          {
            row_id: 'msg-2',
            row_session_id: 'session-2',
            row_time: 1_737_000_001_000,
            data_json: JSON.stringify({
              role: 'user',
              tokens: { input: 999, output: 999 },
            }),
          },
        ],
        seenQueries,
      }),
    });

    const events = await adapter.parseFile('/tmp/opencode.db');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: 'opencode',
      provider: 'anthropic',
      model: 'claude-sonnet-4.5',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      costMode: 'estimated',
    });
    expect(seenQueries.some((query) => query.includes('WHERE json_extract'))).toBe(true);
    expect(
      seenQueries.some(
        (query) => query.includes('FROM "message"') && !query.includes('WHERE json_extract'),
      ),
    ).toBe(true);
  });

  it('throws actionable schema-drift error when message table is unavailable', async () => {
    const adapter = new OpenCodeSourceAdapter({
      pathReadable: async () => true,
      loadSqliteModule: createSqliteLoader({
        tables: ['session', 'part'],
      }),
    });

    await expect(adapter.parseFile('/tmp/opencode.db')).rejects.toThrow(
      'OpenCode schema drift: required "message" table not found.',
    );
  });

  it('retries busy/locked errors and succeeds when lock clears within retry budget', async () => {
    const sleepSpy = vi.fn(async () => undefined);
    const adapter = new OpenCodeSourceAdapter({
      pathReadable: async () => true,
      maxBusyRetries: 2,
      busyRetryDelayMs: 5,
      sleep: sleepSpy,
      loadSqliteModule: createSqliteLoader({
        primaryQueryErrors: [createBusyError()],
        primaryRows: [
          {
            row_id: 'msg-1',
            row_session_id: 'session-1',
            row_time: 1_737_000_000_000,
            data_json: JSON.stringify({
              role: 'assistant',
              providerID: 'openai',
              modelID: 'gpt-4.1',
              tokens: { input: 1, output: 2 },
            }),
          },
        ],
      }),
    });

    const events = await adapter.parseFile('/tmp/opencode.db');

    expect(events).toHaveLength(1);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(5);
  });

  it('fails with actionable guidance when busy/locked retries are exhausted', async () => {
    const adapter = new OpenCodeSourceAdapter({
      pathReadable: async () => true,
      maxBusyRetries: 2,
      busyRetryDelayMs: 5,
      sleep: async () => undefined,
      loadSqliteModule: createSqliteLoader({
        primaryQueryErrors: [createBusyError(), createBusyError(), createBusyError()],
      }),
    });

    await expect(adapter.parseFile('/tmp/opencode.db')).rejects.toThrow(
      'OpenCode DB is busy/locked: /tmp/opencode.db. Retries exhausted after 3 attempt(s).',
    );
  });
});
