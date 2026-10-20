import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        line: 'var(--line)',
        accent: 'var(--muscle)',
        'accent-2': 'var(--muscle-2)',
        'on-accent': 'var(--on-muscle)',
        day: 'var(--day)',
        'day-ink': 'var(--day-ink)',
        box: 'var(--box)',
        cell: 'var(--cell)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        label: 'var(--font-label)',
      },
      maxWidth: {
        content: '780px',
      },
    },
  },
  plugins: [],
};
export default config;
