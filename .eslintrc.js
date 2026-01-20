module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'security'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        // Security-focused rules
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'security/detect-object-injection': 'warn',
        'security/detect-non-literal-regexp': 'warn',
        'security/detect-unsafe-regex': 'error',
        'security/detect-buffer-noassert': 'error',
        'security/detect-child-process': 'warn',
        'security/detect-disable-mustache-escape': 'error',
        'security/detect-eval-with-expression': 'error',
        'security/detect-no-csrf-before-method-override': 'error',
        'security/detect-possible-timing-attacks': 'warn',
        'security/detect-pseudoRandomBytes': 'error',

        // TypeScript-specific rules
        '@typescript-eslint/explicit-function-return-type': 'warn',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_' },
        ],

        // Code quality
        'no-console': 'warn',
        'prefer-const': 'error',
        'no-var': 'error',
    },
    ignorePatterns: ['out', 'dist', '**/*.d.ts', 'node_modules'],
};
