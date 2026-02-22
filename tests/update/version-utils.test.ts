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
    expect(compareVersions('1.2.3-beta.2', '1.2.3')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.3.0', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.4', '1.2.3')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('not-a-version', '1.2.3')).toBe(0);

    expect(compareVersions('1.2.3-alpha.1', '1.2.3-alpha.beta')).toBeLessThan(0);
    expect(compareVersions('1.2.3-alpha.beta', '1.2.3-alpha.1')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3-alpha.beta', '1.2.3-alpha.gamma')).toBeLessThan(0);
    expect(compareVersions('1.2.3-alpha', '1.2.3-alpha.1')).toBeLessThan(0);
    expect(compareVersions('1.2.3-alpha.1', '1.2.3-alpha')).toBeGreaterThan(0);

    expect(shouldOfferUpdate('1.2.3', '1.3.0-beta.1')).toBe(false);
    expect(shouldOfferUpdate('1.2.3-beta.1', '1.2.3')).toBe(true);
    expect(shouldOfferUpdate('1.2.3', 'not-a-version')).toBe(false);
  });
});
