import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';

export default [
    {
        ignores: [
            'js/exsurge.min.js',
            'js/Tone.min.js',
            'js/tones.js',
            'js/saveSvgAsPng.js',
            'css/output.css',
            'node_modules/',
            'old/',
        ],
    },
    {
        files: ['js/**/*.js', 'tests/**/*.js'],
        ...js.configs.recommended,
        rules: {
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                navigator: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                CustomEvent: 'readonly',
                MutationObserver: 'readonly',
                ResizeObserver: 'readonly',
                IntersectionObserver: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                HTMLElement: 'readonly',
                SVGElement: 'readonly',
                Event: 'readonly',
                KeyboardEvent: 'readonly',
                MouseEvent: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                AudioContext: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                HTMLButtonElement: 'readonly',
                // Exsurge and tone globals injected via classic scripts
                exsurge: 'readonly',
                Tone: 'readonly',
                saveSvgAsPng: 'readonly',
                saveSvg: 'readonly',
            },
        },
    },
    prettierConfig,
];
