import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  parseVersion,
  shouldOfferUpdate,
} from '../../src/update/version-utils.js';

describe('version-utils', () => {
  it('parses valid semantic versions and rejects invalid values', () => {
    expect(parseVersion('v1.2.3-beta.1')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['beta', '1'],
    });
    expect(parseVersion('1.2')).toBeUndefined();
    expect(parseVersion('not-a-version')).toBeUndefined();
  });

  it('compares versions and applies stable-to-prerelease offer rules', () => {
    expect(compareVersions('1.2.3', '1.2.3-beta.2')).toBeGreaterThan(0);
    expect(shouldOfferUpdate('1.2.3', '1.3.0-beta.1')).toBe(false);
    expect(shouldOfferUpdate('1.2.3-beta.1', '1.2.3')).toBe(true);
  });
});
