import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'js', 'css', 'data', 'eslint.config.js'] },

  // ── New React UI — strict TypeScript ──────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2021,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The preserved trading core is plain JS; values crossing the JS↔TS
      // boundary (CFG/ST/snapshot) are intentionally untyped. `any` is allowed
      // there. New UI logic should still prefer precise types.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ── Preserved vanilla-JS trading core/services ────────────────────
  // These modules are ported verbatim from the original app to guarantee
  // behavioral parity (see README "Migration notes"). Linting is relaxed to
  // the essentials; `no-undef` stays on to catch genuinely missing imports.
  {
    files: ['src/core/**/*.js', 'src/services/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-constant-condition': 'off',
      'no-fallthrough': 'off',
      'no-prototype-builtins': 'off',
      // Ported regexes/char-classes are kept verbatim; escaping is stylistic.
      'no-useless-escape': 'off',
    },
  },

  prettier,
);
