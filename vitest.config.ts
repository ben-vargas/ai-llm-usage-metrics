import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/cli/index.ts', 'src/domain/usage-report-row.ts', 'src/pricing/types.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
    },
  },
});
