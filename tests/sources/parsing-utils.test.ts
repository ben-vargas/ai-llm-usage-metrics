import { describe, expect, it } from 'vitest';

import { asTrimmedText, isBlankText, toNumberLike } from '../../src/sources/parsing-utils.js';

describe('source parsing helpers', () => {
  it('normalizes trimmed text values', () => {
    expect(asTrimmedText('  hello  ')).toBe('hello');
    expect(asTrimmedText('   ')).toBeUndefined();
    expect(asTrimmedText(123)).toBeUndefined();
  });

  it('checks blank strings', () => {
    expect(isBlankText('')).toBe(true);
    expect(isBlankText('   ')).toBe(true);
    expect(isBlankText(' value ')).toBe(false);
  });

  it('converts unknown values to NumberLike safely', () => {
    expect(toNumberLike(42)).toBe(42);
    expect(toNumberLike('42')).toBe('42');
    expect(toNumberLike(null)).toBeNull();
    expect(toNumberLike(undefined)).toBeUndefined();
    expect(toNumberLike({ value: 42 })).toBeUndefined();
    expect(toNumberLike([42])).toBeUndefined();
  });
});
