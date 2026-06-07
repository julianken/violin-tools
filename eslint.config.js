import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import vitest from '@vitest/eslint-plugin';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

// Root ESLint flat config (ESLint 10). Two layers stack here:
//   1. The TYPE-CHECKED layer (PR #55): JS recommended + typescript-eslint
//      strict-type-checked + stylistic-type-checked, wired type-aware via
//      `projectService` (auto-resolves the nearest tsconfig per file).
//   2. The ANTI-SLOP layer (this PR): four MIT, ESLint-10-peer plugins
//      (import-x, unused-imports, @vitest/eslint-plugin, eslint-comments) +
//      core rules that catch the ways an LLM degrades a codebase under
//      iteration — leftover console/debugger, dead imports, .only/.skip that
//      green CI, and the #1 gate-gaming move: a blanket eslint-disable.
// The ruleset is intentionally small. If a rule fires, fix the code — don't
// disable to silence (and reportUnusedDisableDirectives makes a stale
// suppression itself fail the gate).
export default tseslint.config(
  // (1) GLOBAL ignores — object with ONLY `ignores`.
  {
    ignores: ['**/dist/**', '**/.turbo/**', '**/coverage/**', '**/node_modules/**'],
  },
  // (2) Stale `eslint-disable` directives fail the gate (deterministic
  //     counterpart to eslint-comments/no-unused-disable — use this, not the
  //     plugin rule).
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  // (3) Base, everywhere.
  js.configs.recommended,
  // strictTypeChecked ⊃ recommendedTypeChecked ⊃ recommended (was: configs.recommended,
  // which is type-UNAWARE). stylisticTypeChecked adds low-noise consistency rules.
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // (4) Type-aware wiring + anti-slop core/plugins, ALL TS/TSX.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      parserOptions: {
        // Turns on type-aware linting; projectService resolves each file to its
        // nearest tsconfig with no per-package glob list.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
      'unused-imports': unusedImports,
      '@eslint-community/eslint-comments': eslintComments,
    },
    settings: {
      // createNodeResolver — NOT importX.flatConfigs.typescript, which throws 51
      // false "unable to resolve" under ESLint 10 + import-x 4.16, and NO extra
      // resolver dep (eslint-import-resolver-typescript is not needed).
      'import-x/resolver-next': [
        importX.createNodeResolver({ extensions: ['.ts', '.tsx', '.js', '.jsx'] }),
      ],
    },
    rules: {
      // Dead imports/vars — auto-strippable. tseslint's no-unused-vars only
      // reports; hand the job to unused-imports so --fix removes them.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Import hygiene.
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        { 'newlines-between': 'always', alphabetize: { order: 'asc' } },
      ],
      // import-x/no-cycle is HELD — non-functional on Node 24 (zero messages on
      // a textbook 2-file cycle). Re-test on Node 22 before enabling (GAPS row).

      // Gate-gaming defenses.
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@eslint-community/eslint-comments/require-description': 'error',

      // Agent debugging artifacts.
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',

      // Tighten the @ts-expect-error description floor (already error via
      // recommended); forbid @ts-ignore / @ts-nocheck outright.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],

      // NOT adding @typescript-eslint/consistent-type-imports: verbatimModuleSyntax
      // already enforces type-only imports at the compiler level; the rule's own
      // docs say never run both (they emit conflicting errors).
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  // (5) apps/web — browser globals + React. Scoped to apps/web/** so a future
  //     DOM-free packages/theory does NOT inherit browser globals or the React
  //     plugins.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // recommended-latest = the v7 flat preset (was the legacy .recommended).
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-alert': 'error',
    },
  },
  // (6) Config / non-program files live outside any tsconfig `include`, so the
  // type-aware rules have no type info and would error. disableTypeChecked turns
  // the type-aware subset OFF there (no allowDefaultProject cap, no type-check cost).
  {
    files: ['**/*.config.{js,ts}', 'eslint.config.js', '**/*.cjs', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
  // (7) Tests stay type-checked, but relax the rules that fixtures / mocks /
  // spies / deliberate bad input legitimately trip, and add the Vitest rules.
  // disableTypeChecked is NOT used here: we want the type-aware coverage, minus
  // this named set.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/vitest.setup.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { vitest },
    rules: {
      // recommended brings no-focused-tests (error: .only never belongs in
      // committed code — NOT no-only-tests, which does not exist and crashes
      // ESLint), no-disabled-tests (warn: .skip/.todo), valid-expect, etc.
      ...vitest.configs.recommended.rules,
      'vitest/no-focused-tests': 'error',
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  // (8) Prettier LAST — disables stylistic rules that would conflict with the
  // formatter. Inert today (none of the added plugins are stylistic), kept as
  // future insurance.
  eslintConfigPrettier,
);
