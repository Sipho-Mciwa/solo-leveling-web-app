import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        border: '#222222',
        accent: '#7c3aed',
        'accent-light': '#a78bfa',
        // #666 on #0a0a0a was ~3.4:1, below WCAG AA's 4.5:1 for normal text —
        // this app uses `muted` pervasively at 9-11px. #8a8a8a is ~5.75:1.
        muted: '#8a8a8a',
        subtle: '#333333',

        system: '#38bdf8',
        'system-light': '#7dd3fc',
        danger: '#f87171',
        'danger-light': '#fca5a5',
        warning: '#fbbf24',
        success: '#34d399',
        info: '#60a5fa',

        'rank-e': '#9ca3af',
        'rank-d': '#4ade80',
        'rank-c': '#60a5fa',
        'rank-b': '#c084fc',
        'rank-a': '#facc15',
        'rank-s': '#f87171',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
