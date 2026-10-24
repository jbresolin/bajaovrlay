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
    // docs/design/vendor/ holds third-party files copied as their authors ship them (GSAP for
    // the design's motion demos), never edited here.
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/test-results/',
      '**/playwright-report/',
      '.scratch/',
      'docs/design/vendor/',
    ],
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
    files: ['apps/server/**', '**/*.config.{js,ts}', 'scripts/**'],
    languageOptions: { globals: globals.node },
  },

  {
    // The design mock-up tools (docs/design, BAJAOVRLAY-22): small Node scripts a person runs
    // from the terminal, so printing to the console is what they are for. Nothing here runs
    // in the product.
    files: ['docs/design/tools/**/*.mjs', 'docs/design/directions/**/generatePages.mjs'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },

  {
    // The design mock-ups' motion demo runs in a browser, from a static page.
    files: ['docs/design/tools/slateMotionDemo.js'],
    languageOptions: { globals: globals.browser },
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

  {
    // The race simulator must give the same race for the same seed and moment, so every
    // random number comes from its seededRandom.ts; an unseeded draw would break that
    // quietly. (simulatorHasNoMathRandom.test.ts checks the folder's files as well.)
    files: ['apps/server/src/modules/dataSources/adapters/simulator/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'The simulator draws every number from seededRandom.ts.',
        },
      ],
    },
  },

  {
    // Every word the operator reads comes from the pt-BR catalog (src/i18n/ptBR.ts).
    // These two rules catch the ways text gets written inline by accident: words between
    // tags, and a quoted string in an attribute people read or hear. Text in braces
    // (`{'...'}`) is not caught, so this is a safety net and not a proof. Tests are
    // exempt: they must spell out the expected text.
    files: ['apps/control/src/features/**/*.tsx', 'apps/control/src/app/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\S/]',
          message: 'No inline UI text: add the string to src/i18n/ptBR.ts and use it from there.',
        },
        {
          selector: 'JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/] > Literal',
          message: 'No inline UI text: add the string to src/i18n/ptBR.ts and use it from there.',
        },
      ],
    },
  },
);
