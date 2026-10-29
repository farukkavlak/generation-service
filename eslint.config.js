import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      eqeqeq: 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./\\.\\./',
              message: 'src/lib must not depend on application code.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./',
              message: 'src/lib must not depend on application code.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*-service.ts', 'src/**/types.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express/*', 'pg', 'pg/*', 'pg-*', 'ioredis', 'ioredis/*'],
              message: 'Services must not depend on Postgres, Redis or Express directly.',
            },
            {
              regex: '/(infra|http)/|^\\.\\./(server|config)\\.js$',
              message: 'Services must not depend on infrastructure, HTTP, config or wiring.',
            },
            {
              regex: '-controller\\.js$',
              message: 'Services must not depend on controllers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*-controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['pg', 'pg/*', 'pg-*', 'ioredis', 'ioredis/*'],
              message: 'Controllers must not talk to Postgres or Redis; call the service.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*-repository.ts', 'src/**/result-cache.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express/*'],
              message: 'Data access must not depend on HTTP.',
            },
            {
              regex: '/http/|-controller\\.js$',
              message: 'Data access must not depend on HTTP.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infra/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./(?!lib/)',
              message: 'Infrastructure holds connections only and may depend on lib only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
