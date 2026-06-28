const typescriptEslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    ignores: [
      'frontend/**',
      'lambda/**',
      'cdk.out/**',
      'node_modules/**',
    ],
  },
  ...typescriptEslint.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        exports: 'writable',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        test: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
];
