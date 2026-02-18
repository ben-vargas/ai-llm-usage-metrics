import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readJsonlObjects } from '../../src/utils/read-jsonl-objects.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('readJsonlObjects', () => {
  it('streams valid JSON objects and skips malformed lines', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'read-jsonl-objects-'));
    tempDirs.push(rootDir);

    const filePath = path.join(rootDir, 'session.jsonl');

    await writeFile(
      filePath,
      [
        '{"type":"session","id":"a"}',
        'not-json',
        '[1,2,3]',
        '{"type":"message","index":2}',
        '   ',
      ].join('\n'),
      'utf8',
    );

    const records: Array<Record<string, unknown>> = [];

    for await (const record of readJsonlObjects(filePath)) {
      records.push(record);
    }

    expect(records).toEqual([
      { type: 'session', id: 'a' },
      { type: 'message', index: 2 },
    ]);
  });

  it('handles UTF-8 BOM on the first JSONL line', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'read-jsonl-bom-'));
    tempDirs.push(rootDir);

    const filePath = path.join(rootDir, 'with-bom.jsonl');

    await writeFile(filePath, `\uFEFF${JSON.stringify({ type: 'session', id: 'bom' })}\n`, 'utf8');

    const records: Array<Record<string, unknown>> = [];

    for await (const record of readJsonlObjects(filePath)) {
      records.push(record);
    }

    expect(records).toEqual([{ type: 'session', id: 'bom' }]);
  });

  it('scales to many JSONL lines without loading malformed data', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'read-jsonl-many-lines-'));
    tempDirs.push(rootDir);

    const filePath = path.join(rootDir, 'many-lines.jsonl');
    const lineCount = 10_000;
    const lines = Array.from({ length: lineCount }, (_, index) =>
      JSON.stringify({ type: 'message', index }),
    );

    await writeFile(filePath, lines.join('\n'), 'utf8');

    let count = 0;

    for await (const record of readJsonlObjects(filePath)) {
      if (record.type === 'message') {
        count += 1;
      }
    }

    expect(count).toBe(lineCount);
  });

  it('propagates file read errors', async () => {
    const missingPath = path.join(os.tmpdir(), `read-jsonl-missing-${Date.now()}.jsonl`);

    await expect(async () => {
      for await (const record of readJsonlObjects(missingPath)) {
        void record;
      }
    }).rejects.toThrow();
  });
});
