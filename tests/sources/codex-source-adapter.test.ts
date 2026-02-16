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
      inputTokens: 100,
      cacheReadTokens: 20,
      outputTokens: 50,
      reasoningTokens: 10,
      totalTokens: 180,
      costMode: 'estimated',
    });

    expect(events[1]).toMatchObject({
      source: 'codex',
      sessionId: 'codex-session-1',
      provider: 'openai',
      model: 'gpt-5.1-codex',
      inputTokens: 50,
      cacheReadTokens: 5,
      outputTokens: 15,
      reasoningTokens: 5,
      totalTokens: 75,
      costMode: 'estimated',
    });

    expect(events.every((event) => event.inputTokens >= 0)).toBe(true);
    expect(events.every((event) => event.totalTokens >= 0)).toBe(true);
  });

  it('uses legacy model fallback when no model metadata exists', async () => {
    const fixturePath = path.resolve('tests/fixtures/codex/session-legacy-model.jsonl');
    const adapter = new CodexSourceAdapter();

    const events = await adapter.parseFile(fixturePath);

    expect(events).toHaveLength(1);
    expect(events[0]?.model).toBe(LEGACY_CODEX_MODEL_FALLBACK);
  });
});

describe('codex source helpers', () => {
  it('returns default codex sessions path', () => {
    expect(getDefaultCodexSessionsDir()).toContain(path.join('.codex', 'sessions'));
  });
});
