import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));
const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

function scopeToFiles(configs, files) {
  return configs.map((config) => ({
    ...config,
    files: config.files ?? files,
  }));
}

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'site/**',
      '.github/scripts/**',
      'scripts/**',
      '*.tgz',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...scopeToFiles(tseslint.configs.recommendedTypeChecked, tsFiles),
  ...scopeToFiles(tseslint.configs.strictTypeChecked, tsFiles),
  ...scopeToFiles(tseslint.configs.stylisticTypeChecked, tsFiles),
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
        },
      ],
      'no-duplicate-imports': [
        'error',
        {
          allowSeparateTypeImports: true,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Inline dynamic imports are forbidden; use top-level static imports instead.',
        },
      ],
    },
  },
  prettierConfig,
);
