import { describe, expect, it } from 'vitest';

import {
  normalizeModelList,
  normalizeNonNegativeInteger,
  normalizeTimestamp,
  normalizeUsdCost,
} from '../../src/domain/normalization.js';

describe('normalizeNonNegativeInteger', () => {
  it('returns zero for undefined, null and invalid values', () => {
    expect(normalizeNonNegativeInteger(undefined)).toBe(0);
    expect(normalizeNonNegativeInteger(null)).toBe(0);
    expect(normalizeNonNegativeInteger('not-a-number')).toBe(0);
  });

  it('clamps negative values and truncates decimals', () => {
    expect(normalizeNonNegativeInteger(-5)).toBe(0);
    expect(normalizeNonNegativeInteger(12.9)).toBe(12);
    expect(normalizeNonNegativeInteger('42.8')).toBe(42);
  });
});

describe('normalizeUsdCost', () => {
  it('returns undefined for absent or invalid values', () => {
    expect(normalizeUsdCost(undefined)).toBeUndefined();
    expect(normalizeUsdCost('')).toBeUndefined();
    expect(normalizeUsdCost('   ')).toBeUndefined();
    expect(normalizeUsdCost('N/A')).toBeUndefined();
  });

  it('clamps negative values to zero', () => {
    expect(normalizeUsdCost(-1.2)).toBe(0);
    expect(normalizeUsdCost('1.23')).toBe(1.23);
  });
});

describe('normalizeTimestamp', () => {
  it('normalizes parsable values to ISO string', () => {
    expect(normalizeTimestamp('2026-02-10T12:00:00Z')).toBe('2026-02-10T12:00:00.000Z');
  });

  it('throws when timestamp is invalid', () => {
    expect(() => normalizeTimestamp('invalid-date')).toThrow('Invalid timestamp');
  });
});

describe('normalizeModelList', () => {
  it('deduplicates, trims and sorts model ids', () => {
    expect(normalizeModelList([' gpt-4o ', 'gpt-4.1', undefined, 'gpt-4o', ''])).toEqual([
      'gpt-4.1',
      'gpt-4o',
    ]);
  });
});
