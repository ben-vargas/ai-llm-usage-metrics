import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultAdapters } from '../../src/sources/create-default-adapters.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('createDefaultAdapters', () => {
  it('builds pi and codex adapters in stable order', () => {
    const adapters = createDefaultAdapters({}, 'openai');

    expect(adapters.map((adapter) => adapter.id)).toEqual(['pi', 'codex']);
  });

  it('wires provider filtering into the pi adapter', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'usage-adapters-provider-filter-'));
    tempDirs.push(tempDir);

    const filePath = path.join(tempDir, 'session.jsonl');

    await writeFile(
      filePath,
      [
        JSON.stringify({
          type: 'session',
          id: 'session-1',
          timestamp: '2026-02-14T10:00:00.000Z',
        }),
        JSON.stringify({
          type: 'model_change',
          provider: 'anthropic',
          model: 'claude-3.7-sonnet',
        }),
        JSON.stringify({
          type: 'message',
          timestamp: '2026-02-14T10:00:01.000Z',
          usage: {
            input: 10,
            output: 5,
            totalTokens: 15,
          },
        }),
      ].join('\n'),
      'utf8',
    );

    const openAiFilteredAdapters = createDefaultAdapters({ piDir: tempDir }, 'openai');
    const openAiPiAdapter = openAiFilteredAdapters[0];

    const openAiEvents = await openAiPiAdapter.parseFile(filePath);

    expect(openAiEvents).toHaveLength(0);

    const anthropicFilteredAdapters = createDefaultAdapters({ piDir: tempDir }, 'anthropic');
    const anthropicPiAdapter = anthropicFilteredAdapters[0];

    const anthropicEvents = await anthropicPiAdapter.parseFile(filePath);

    expect(anthropicEvents).toHaveLength(1);
    expect(anthropicEvents[0]).toMatchObject({ source: 'pi', provider: 'anthropic' });
  });
});
