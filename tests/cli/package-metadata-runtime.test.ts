import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSpy = vi.hoisted(() => vi.fn<(path: string) => unknown>());

vi.mock('node:module', () => {
  return {
    createRequire: () => requireSpy,
  };
});

import { loadPackageMetadataFromRuntime } from '../../src/cli/package-metadata.js';

describe('loadPackageMetadataFromRuntime', () => {
  beforeEach(() => {
    requireSpy.mockReset();
  });

  it('falls back to later candidate when first runtime candidate is partial', () => {
    requireSpy.mockImplementation((candidatePath) => {
      if (candidatePath === '../package.json') {
        return {
          name: 'llm-usage-metrics',
        };
      }

      if (candidatePath === '../../package.json') {
        return {
          name: 'llm-usage-metrics',
          version: '5.1.0',
        };
      }

      throw new Error(`unexpected path: ${candidatePath}`);
    });

    const metadata = loadPackageMetadataFromRuntime();

    expect(metadata).toEqual({
      packageName: 'llm-usage-metrics',
      packageVersion: '5.1.0',
    });
    expect(requireSpy).toHaveBeenCalledTimes(2);
    expect(requireSpy).toHaveBeenNthCalledWith(1, '../package.json');
    expect(requireSpy).toHaveBeenNthCalledWith(2, '../../package.json');
  });
});
