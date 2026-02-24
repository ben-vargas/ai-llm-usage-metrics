import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CodexSourceAdapter,
  getDefaultCodexSessionsDir,
  LEGACY_CODEX_MODEL_FALLBACK,
} from '../../src/sources/codex/codex-source-adapter.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('CodexSourceAdapter', () => {
  it('discovers jsonl files recursively in deterministic order', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'codex-source-adapter-'));
    tempDirs.push(root);

    const nested = path.join(root, 'nested');
    await mkdir(nested, { recursive: true });

    const first = path.join(root, 'a.jsonl');
    const second = path.join(nested, 'b.jsonl');

    await writeFile(path.join(root, 'ignore.log'), 'noop', 'utf8');
    await writeFile(second, '{}\n', 'utf8');
    await writeFile(first, '{}\n', 'utf8');

    const adapter = new CodexSourceAdapter({ sessionsDir: root });

    await expect(adapter.discoverFiles()).resolves.toEqual([first, second]);
  });

  it('parses token_count lines and derives deltas without negatives', async () => {
    const fixturePath = path.resolve('tests/fixtures/codex/session-token-count.jsonl');
    const adapter = new CodexSourceAdapter();

    const events = await adapter.parseFile(fixturePath);

    expect(events).toHaveLength(2);

    expect(events[0]).toMatchObject({
      source: 'codex',
      sessionId: 'codex-session-1',
      provider: 'openai',
      model: 'gpt-5.2-codex',
      inputTokens: 80,
      cacheReadTokens: 20,
      outputTokens: 50,
      reasoningTokens: 10,
      totalTokens: 150,
      costMode: 'estimated',
    });

    expect(events[1]).toMatchObject({
      source: 'codex',
      sessionId: 'codex-session-1',
      provider: 'openai',
      model: 'gpt-5.1-codex',
      inputTokens: 45,
      cacheReadTokens: 5,
      outputTokens: 15,
      reasoningTokens: 5,
      totalTokens: 65,
      costMode: 'estimated',
    });

    expect(events.every((event) => event.inputTokens >= 0)).toBe(true);
    expect(events.every((event) => event.totalTokens >= 0)).toBe(true);
  });

  it('accumulates previous totals when consecutive events only include last_token_usage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'codex-source-last-usage-'));
    tempDirs.push(root);

    const filePath = path.join(root, 'session.jsonl');

    await writeFile(
      filePath,
      [
        JSON.stringify({
          timestamp: '2026-02-14T10:00:00.000Z',
          type: 'session_meta',
          payload: {
            id: 'codex-last-usage',
            model_provider: 'openai',
            cwd: '/tmp/codex-repo',
          },
        }),
        JSON.stringify({
          timestamp: '2026-02-14T10:00:01.000Z',
          type: 'turn_context',
          payload: { model: 'gpt-5.2-codex' },
        }),
        JSON.stringify({
          timestamp: '2026-02-14T10:00:02.000Z',
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              last_token_usage: {
                input_tokens: 10,
                cached_input_tokens: 2,
                output_tokens: 5,
                reasoning_output_tokens: 1,
                total_tokens: 15,
              },
            },
          },
        }),
        JSON.stringify({
          timestamp: '2026-02-14T10:00:03.000Z',
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              last_token_usage: {
                input_tokens: 20,
                cached_input_tokens: 5,
                output_tokens: 5,
                reasoning_output_tokens: 2,
                total_tokens: 25,
              },
            },
          },
        }),
        JSON.stringify({
          timestamp: '2026-02-14T10:00:04.000Z',
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 40,
                cached_input_tokens: 10,
                output_tokens: 20,
                reasoning_output_tokens: 4,
                total_tokens: 60,
              },
            },
          },
        }),
      ].join('\n'),
      'utf8',
    );

    const adapter = new CodexSourceAdapter({ sessionsDir: root });
    const events = await adapter.parseFile(filePath);

    expect(events).toHaveLength(3);
    expect(events[0]?.totalTokens).toBe(15);
    expect(events[1]?.totalTokens).toBe(25);
    expect(events[2]?.totalTokens).toBe(20);
    expect(events.every((event) => event.repoRoot === '/tmp/codex-repo')).toBe(true);
  });

  it('uses legacy model fallback when no model metadata exists', async () => {
    const fixturePath = path.resolve('tests/fixtures/codex/session-legacy-model.jsonl');
    const adapter = new CodexSourceAdapter();

    const events = await adapter.parseFile(fixturePath);

    expect(events).toHaveLength(1);
    expect(events[0]?.model).toBe(LEGACY_CODEX_MODEL_FALLBACK);
    expect(events[0]?.inputTokens).toBe(9);
    expect(events[0]?.cacheReadTokens).toBe(3);
    expect(events[0]?.totalTokens).toBe(19);
  });
});

describe('codex source helpers', () => {
  it('returns default codex sessions path', () => {
    expect(getDefaultCodexSessionsDir()).toContain(path.join('.codex', 'sessions'));
  });
});
