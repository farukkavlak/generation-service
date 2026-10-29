import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const EXPRESS = ['express', 'express/*'];
const DATA_STORE_CLIENTS = ['pg', 'pg/*', 'pg-*', 'ioredis', 'ioredis/*'];
const WIRING = '^(\\.\\./)+(server|config)\\.js$';

function restrictImports(files, patterns) {
  return { files, rules: { 'no-restricted-imports': ['error', { patterns }] } };
}

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
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
  restrictImports(
    ['src/lib/**/*.ts'],
    [{ regex: '^\\.\\./', message: 'lib must not depend on application code.' }],
  ),
  restrictImports(
    ['src/infra/**/*.ts'],
    [
      {
        regex: '^\\.\\./(?!lib/)',
        message: 'infra holds connections only and may depend on lib only.',
      },
    ],
  ),
  restrictImports(
    ['src/http/**/*.ts'],
    [
      {
        regex: '^\\.\\./(?!lib/)',
        message: 'http is feature-independent and may depend on lib only.',
      },
    ],
  ),
  restrictImports(
    ['src/**/*-service.ts', 'src/generations/generation.ts', 'src/**/ai-provider.ts'],
    [
      {
        group: [...EXPRESS, ...DATA_STORE_CLIENTS],
        message: 'Business code must not use Express, Postgres or Redis.',
      },
      {
        regex: `/(infra|http)/|-controller\\.js$|${WIRING}`,
        message: 'Business code must not depend on infra, HTTP, controllers or wiring.',
      },
    ],
  ),
  restrictImports(
    ['src/**/*-controller.ts'],
    [
      {
        group: DATA_STORE_CLIENTS,
        message: 'Controllers call the service; they must not use Postgres or Redis.',
      },
      {
        regex: '/infra/|-repository\\.js$|result-cache\\.js$',
        message: 'Controllers call the service, not data access.',
      },
    ],
  ),
  restrictImports(
    ['src/**/*-repository.ts', 'src/**/result-cache.ts'],
    [
      { group: EXPRESS, message: 'Data access must not use Express.' },
      {
        regex: `/http/|-controller\\.js$|${WIRING}`,
        message: 'Data access must not depend on HTTP, controllers or wiring.',
      },
    ],
  ),
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
