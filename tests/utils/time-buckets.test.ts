import { describe, expect, it } from 'vitest';

import { getPeriodKey } from '../../src/utils/time-buckets.js';

describe('time bucket helpers', () => {
  it('uses Monday-based weekly boundaries with ISO-like week keys', () => {
    expect(getPeriodKey('2026-01-04T12:00:00Z', 'weekly', 'UTC')).toBe('2026-W01');
    expect(getPeriodKey('2026-01-05T12:00:00Z', 'weekly', 'UTC')).toBe('2026-W02');
  });

  it('applies timezone when generating daily keys', () => {
    expect(getPeriodKey('2026-01-04T23:30:00Z', 'daily', 'UTC')).toBe('2026-01-04');
    expect(getPeriodKey('2026-01-04T23:30:00Z', 'daily', 'Asia/Tokyo')).toBe('2026-01-05');
  });

  it('formats monthly keys as YYYY-MM', () => {
    expect(getPeriodKey('2026-08-14T00:00:00Z', 'monthly', 'UTC')).toBe('2026-08');
  });
});
