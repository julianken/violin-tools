import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Root ESLint flat config (ESLint 10). Type-checked anti-slop gate for a React +
// TS app: JS recommended + typescript-eslint strict-type-checked + stylistic-
// type-checked + the React Hooks rules + the Vite Fast-Refresh export rule.
// Type-aware linting is wired via `projectService` (auto-resolves the nearest
// tsconfig per file across the apps/web + future packages monorepo). Anti-slop
// import/test plugins (import-x, unused-imports, vitest, eslint-comments) are a
// separate PR — not added here.
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.turbo/**', '**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  // strictTypeChecked ⊃ recommendedTypeChecked ⊃ recommended (was: configs.recommended,
  // which is type-UNAWARE). stylisticTypeChecked adds low-noise consistency rules.
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        // Turns on type-aware linting; projectService resolves each file to its
        // nearest tsconfig with no per-package glob list.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // NOT adding @typescript-eslint/consistent-type-imports: verbatimModuleSyntax
      // already enforces type-only imports at the compiler level; the rule's own
      // docs say never run both (they emit conflicting errors).
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  // Config / non-program files live outside any tsconfig `include`, so the
  // type-aware rules have no type info and would error. disableTypeChecked turns
  // the type-aware subset OFF there (no allowDefaultProject cap, no type-check cost).
  {
    files: ['**/*.config.{js,ts}', 'eslint.config.js', '**/*.cjs', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Tests stay type-checked, but relax the rules that fixtures / mocks / spies /
  // deliberate bad input legitimately trip. disableTypeChecked is NOT used here:
  // we want the type-aware coverage, minus this named set.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/vitest.setup.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
