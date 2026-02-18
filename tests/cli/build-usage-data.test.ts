import { describe, expect, it } from 'vitest';

import { buildUsageData } from '../../src/cli/build-usage-data.js';

describe('buildUsageData', () => {
  it('returns diagnostics contract shape with timezone and env overrides', async () => {
    const result = await buildUsageData(
      'daily',
      {
        timezone: 'UTC',
      },
      {
        getActiveEnvVarOverrides: () => [
          {
            name: 'LLM_USAGE_PARSE_MAX_PARALLEL',
            value: '16',
            description: 'max parallel file parsing',
          },
        ],
      },
    );

    expect(result).toEqual({
      rows: [],
      diagnostics: {
        sessionStats: [],
        pricingOrigin: 'none',
        activeEnvOverrides: [
          {
            name: 'LLM_USAGE_PARSE_MAX_PARALLEL',
            value: '16',
            description: 'max parallel file parsing',
          },
        ],
        timezone: 'UTC',
      },
    });
  });
});
