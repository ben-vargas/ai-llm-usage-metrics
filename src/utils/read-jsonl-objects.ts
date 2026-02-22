import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import { asRecord } from './as-record.js';

export async function* readJsonlObjects(
  filePath: string,
  options: { shouldParseLine?: (lineText: string) => boolean } = {},
): AsyncGenerator<Record<string, unknown>, void, undefined> {
  const stream = createReadStream(filePath, {
    encoding: 'utf8',
  });
  const lineReader = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let isFirstLine = true;

  try {
    for await (const rawLine of lineReader) {
      const normalizedLine = isFirstLine ? rawLine.replace(/^\uFEFF/u, '') : rawLine;
      isFirstLine = false;

      const lineText = normalizedLine.trim();

      if (!lineText) {
        continue;
      }

      if (options.shouldParseLine && !options.shouldParseLine(lineText)) {
        continue;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(lineText);
      } catch {
        continue;
      }

      const parsedObject = asRecord(parsed);

      if (!parsedObject) {
        continue;
      }

      yield parsedObject;
    }
  } finally {
    lineReader.close();
    stream.destroy();
  }
}
