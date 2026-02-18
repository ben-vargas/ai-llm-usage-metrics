import { describe, expect, it } from 'vitest';

import { resolvePackageMetadata } from '../../src/cli/package-metadata.js';

describe('resolvePackageMetadata', () => {
  it('uses first candidate path when valid package metadata exists', () => {
    const metadata = resolvePackageMetadata(
      (candidatePath) => {
        if (candidatePath === '../package.json') {
          return {
            name: 'llm-usage-metrics',
            version: '1.2.3',
          };
        }

        throw new Error('unexpected path');
      },
      ['../package.json', '../../package.json'],
    );

    expect(metadata).toEqual({
      packageName: 'llm-usage-metrics',
      packageVersion: '1.2.3',
    });
  });

  it('falls back to later candidates when earlier ones fail', () => {
    const metadata = resolvePackageMetadata(
      (candidatePath) => {
        if (candidatePath === '../package.json') {
          throw new Error('not found');
        }

        return {
          name: 'llm-usage-metrics',
          version: '2.0.0',
        };
      },
      ['../package.json', '../../package.json'],
    );

    expect(metadata).toEqual({
      packageName: 'llm-usage-metrics',
      packageVersion: '2.0.0',
    });
  });

  it('returns defaults when candidates are missing or malformed', () => {
    const metadata = resolvePackageMetadata(() => {
      return {
        name: ' ',
        version: '',
      };
    }, ['../package.json']);

    expect(metadata).toEqual({
      packageName: 'llm-usage-metrics',
      packageVersion: '0.0.0',
    });
  });
});
