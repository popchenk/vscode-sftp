import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                statements: 80,
                lines: 80,
                functions: 80,
                branches: 70,
            },
            exclude: [
                'node_modules/',
                'out/',
                'dist/',
                '**/*.test.ts',
                '**/*.config.ts',
                '.eslintrc.js',
                'src/extension.ts',
                'src/types/**',
            ],
        },
    },
});
