import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import-x';
import unicornPlugin from 'eslint-plugin-unicorn';

export default [
  js.configs.recommended,
  unicornPlugin.configs['flat/all'],
  {
    plugins: {
      'import-x': importPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
        setTimeout: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        ME_SETTINGS: 'readonly',
        __DEV__: 'readonly',
      },
    },
    rules: {
      strict: ['error', 'global'],
      'func-names': 'off',
      'new-cap': 'off',
      'consistent-return': 'off',
      'no-console': 'off',
      'no-param-reassign': 'off',
      'prefer-arrow-callback': 'off',
      'no-nested-ternary': 'off',
      'no-restricted-syntax': 'off',
      'no-mixed-operators': 'off',
      'no-plusplus': 'off',
      'no-continue': 'off',
      'no-multi-spaces': 'off',
      'max-len': ['error', 155, 2],
      'prefer-template': 'off',
      'no-underscore-dangle': 'off',

      'import-x/extensions': ['error', 'always'],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/test/**/*.js',
            '**/scripts/*.js',
            '**/webpack.config.mjs',
          ],
        },
      ],

      'unicorn/filename-case': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-method-this-argument': 'off',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-unsafe-regex': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/prefer-export-from': 'off',
      'unicorn/prevent-abbreviations': 'off',

      'no-shadow': 'off',
    },
  },
  {
    ignores: ['build/**', 'node_modules/**', 'build-assets.json'],
  },
];
