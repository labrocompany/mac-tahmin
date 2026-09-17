import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-bg-primary)',
        elevated: 'var(--color-bg-elevated)',
        elevated2: 'var(--color-bg-elevated-2)',
        ink: 'var(--color-text-primary)',
        inksecondary: 'var(--color-text-secondary)',
        inktertiary: 'var(--color-text-tertiary)',
        hairline: 'var(--color-border)',
        hairlinestrong: 'var(--color-border-strong)',
        accent: 'var(--color-accent)',
        accenthover: 'var(--color-accent-hover)',
        accentsoft: 'var(--color-accent-soft)',
        win: 'var(--color-green)',
        draw: 'var(--color-orange)',
        loss: 'var(--color-red)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '28px',
      },
    },
  },
  plugins: [],
};

export default config;
