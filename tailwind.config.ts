import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      backgroundImage: {
        'app-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'prediction-gradient': 'linear-gradient(45deg, #f093fb 0%, #f5576c 100%)',
        'toggle-gradient': 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
        'toggle-active-gradient': 'linear-gradient(45deg, #fa709a 0%, #fee140 100%)',
        'btn-gradient': 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
