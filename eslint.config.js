// ESLint flat config for the whole workspace. Formatting is Prettier's job
// (`prettier --check` runs right after ESLint in `pnpm lint`), so no style rules here.
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    // Generated output and the gitignored agent scratch folder are never linted.
    ignores: ['**/dist/', '**/coverage/', '**/test-results/', '**/playwright-report/', '.scratch/'],
  },

  eslint.configs.recommended,
  tseslint.configs.recommended,

  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      // The server logs through its structured logger; the renderer through rendererLog.ts.
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // Over 400 lines usually means a second responsibility moved into the file.
      'max-lines': ['warn', { max: 400 }],
    },
  },

  {
    // Code that runs in Node: the server, every config file and the root scripts.
    files: ['apps/server/**', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },

  {
    // Code that runs in the browser: the control page, the renderer (and the fake graphic
    // its browser tests load) and every graphic.
    files: [
      'apps/control/src/**',
      'apps/renderer/src/**',
      'apps/renderer/test-fixtures/**',
      'packages/graphics/*/src/**',
    ],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ['apps/control/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
);
