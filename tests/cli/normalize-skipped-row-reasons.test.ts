import { describe, expect, it } from 'vitest';

import { normalizeSkippedRowReasons } from '../../src/cli/normalize-skipped-row-reasons.js';

describe('normalizeSkippedRowReasons', () => {
  it('returns empty list for non-array values', () => {
    expect(normalizeSkippedRowReasons(undefined)).toEqual([]);
    expect(normalizeSkippedRowReasons(null)).toEqual([]);
    expect(normalizeSkippedRowReasons('[]')).toEqual([]);
  });

  it('normalizes valid entries and drops invalid ones', () => {
    expect(
      normalizeSkippedRowReasons([
        { reason: ' malformed ', count: 3.9 },
        { reason: '', count: 2 },
        { reason: 'negative', count: -1 },
        { reason: 'nan', count: Number.NaN },
        null,
      ]),
    ).toEqual([{ reason: 'malformed', count: 3 }]);
  });
});
