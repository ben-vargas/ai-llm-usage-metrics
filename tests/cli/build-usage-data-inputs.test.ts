import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeBuildUsageInputs } from '../../src/cli/build-usage-data-inputs.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('build-usage-data-inputs', () => {
  it('falls back to UTC when runtime timezone detection is unavailable', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: undefined as unknown as string,
    });

    const inputs = normalizeBuildUsageInputs({});

    expect(inputs.timezone).toBe('UTC');
  });
});
