import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '.wrangler/', 'src/lib/**/.gear-core.source.js', 'src/lib/**/destiny-handlers.source.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off'
    }
  },
  {
    files: ['scripts/**/*.{js,mjs}', 'server/**/*.js', 'vitest.config.js'],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        caches: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
);
