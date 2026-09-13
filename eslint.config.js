// @ts-check

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.es2021,
                log: 'readonly',
                logError: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
            },
        },
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
);
