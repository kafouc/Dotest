import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-purple': '#7B3BEE',
        'brand-purple-dark': '#5E2FB0',
        'brand-purple-light': '#F3E8FF',
        'brand-pink': '#E91E63',
        'brand-pink-dark': '#B81A4F',
        'brand-pink-light': '#FFEDF4',

        'gradient-start': '#A78BFA',
        'gradient-middle': '#F472B6',
        'gradient-end': '#60A5FA',
      },
      keyframes: {
        'gradient-move': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        'gradient-background': 'gradient-move 30s ease infinite',
      },
    },
  },
  plugins: [],
};
export default config;
