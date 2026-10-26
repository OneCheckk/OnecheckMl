/** @type {import('tailwindcss').Config} */
// OneCheck institutional design tokens.
// Colours are deliberately restrained: one institutional blue family, neutral
// surfaces, and semantic colours reserved for genuine states.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef3f9',
          100: '#dbe6f2',
          200: '#b4c9e2',
          300: '#86a7cf',
          500: '#2f6db2',
          600: '#1d5a9e',
          700: '#174a85',
          800: '#123a6a',
          900: '#0d2a4f',
          950: '#081b34',
        },
        ink: {
          DEFAULT: '#1b2533',
          soft: '#435064',
          faint: '#5f6b7e',
        },
        line: {
          DEFAULT: '#d3dae3',
          soft: '#e5e9ef',
          strong: '#b3bdca',
        },
        canvas: '#f2f4f7',
        saffron: { DEFAULT: '#e2701c', ink: '#a24a08' },
        indiagreen: { DEFAULT: '#13703b' },
        // Semantic states (text / background / border)
        ok: { DEFAULT: '#17643a', bg: '#e9f4ed', line: '#b7dac4' },
        bad: { DEFAULT: '#a4231c', bg: '#fbeceb', line: '#efc3be' },
        warn: { DEFAULT: '#8a4b06', bg: '#fdf4e6', line: '#efd3a6' },
        info: { DEFAULT: '#1d4f8f', bg: '#ebf2fa', line: '#c1d4ec' },
        review: { DEFAULT: '#563785', bg: '#f3eef9', line: '#d7c9eb' },
        muted: { DEFAULT: '#4a5568', bg: '#f1f3f6', line: '#d3dae3' },
        // Legacy aliases kept so existing class names keep resolving
        gov: {
          dark: '#081b34',
          navy: '#0d2a4f',
          blue: '#174a85',
          accent: '#1d5a9e',
          light: '#eef3f9',
          border: '#d3dae3',
          saffron: '#e2701c',
          ashoka: '#000080',
          green: '#13703b',
        },
        status: {
          green: '#17643a',
          red: '#a4231c',
          amber: '#8a4b06',
          blue: '#1d4f8f',
          grey: '#4a5568',
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'Poppins',
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Noto Sans"',
          '"Noto Sans Devanagari"',
          'sans-serif',
        ],
        display: [
          '"Plus Jakarta Sans"',
          'Poppins',
          'sans-serif',
        ],
        mono: ['Consolas', '"Liberation Mono"', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
        meta: ['0.75rem', '1.0625rem'],
        table: ['0.8125rem', '1.1875rem'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
      },
      maxWidth: {
        page: '1280px',
      },
    },
  },
  plugins: [],
};
