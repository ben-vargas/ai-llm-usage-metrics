import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  getDefaultPiSessionsDir,
  isOpenAiProvider,
  PiSourceAdapter,
} from '../../src/sources/pi/pi-source-adapter.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('PiSourceAdapter', () => {
  it('discovers jsonl files recursively in deterministic order', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pi-source-adapter-'));
    tempDirs.push(root);

    const nested = path.join(root, 'nested');
    await mkdir(nested, { recursive: true });

    const first = path.join(root, 'a.jsonl');
    const second = path.join(nested, 'b.jsonl');

    await writeFile(path.join(root, 'ignore.txt'), 'noop', 'utf8');
    await writeFile(second, '{}\n', 'utf8');
    await writeFile(first, '{}\n', 'utf8');

    const adapter = new PiSourceAdapter({ sessionsDir: root, providerFilter: () => true });

    await expect(adapter.discoverFiles()).resolves.toEqual([first, second]);
  });

  it('parses usage events and filters non-openai providers by default', async () => {
    const fixturePath = path.resolve('tests/fixtures/pi/session-mixed.jsonl');
    const adapter = new PiSourceAdapter();

    const events = await adapter.parseFile(fixturePath);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      source: 'pi',
      sessionId: 'session-pi-1',
      provider: 'openai-codex',
      model: 'gpt-5.3-codex',
      inputTokens: 100,
      outputTokens: 20,
      reasoningTokens: 5,
      cacheReadTokens: 10,
      cacheWriteTokens: 3,
      totalTokens: 120,
      costUsd: 0.01,
      costMode: 'explicit',
    });

    expect(events[1]).toMatchObject({
      source: 'pi',
      sessionId: 'session-pi-1',
      provider: 'openai',
      model: 'gpt-4.1',
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
      costMode: 'estimated',
    });

    expect(events[1]?.timestamp).toBe('2026-02-12T20:01:00.000Z');
  });

  it('supports provider filter override for extensibility', async () => {
    const fixturePath = path.resolve('tests/fixtures/pi/session-mixed.jsonl');
    const adapter = new PiSourceAdapter({ providerFilter: () => true });

    const events = await adapter.parseFile(fixturePath);

    expect(events).toHaveLength(3);
    expect(events.some((event) => event.provider === 'anthropic')).toBe(true);
  });
});

describe('pi source helpers', () => {
  it('detects openai-like provider names', () => {
    expect(isOpenAiProvider('openai')).toBe(true);
    expect(isOpenAiProvider('OpenAI-Codex')).toBe(true);
    expect(isOpenAiProvider('anthropic')).toBe(false);
    expect(isOpenAiProvider(undefined)).toBe(false);
  });

  it('returns the default pi sessions path', () => {
    expect(getDefaultPiSessionsDir()).toContain(path.join('.pi', 'agent', 'sessions'));
  });
});
