import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Focused on bug-catching rules only (undefined identifiers, hook violations,
// duplicate keys) — style rules intentionally left out.
export default [
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    settings: { react: { version: '19.0' } },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error',
      'no-compare-neg-zero': 'error',
      'no-cond-assign': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'react/jsx-key': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
