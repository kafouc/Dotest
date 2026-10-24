import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class'],
    content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			// Nouvelles couleurs de la marque
  			'brand-yellow': '#fbbf1d',
  			'brand-yellow-dark': '#d4a017',
  			'brand-yellow-light': '#fef3c7',
  			'brand-teal': '#45BF9A',
  			'brand-teal-dark': '#2d8f6f',
  			'brand-teal-light': '#d1fae5',
  			'brand-dark': '#333333',
  			'brand-dark-light': '#4a4a4a',
  			'brand-dark-lighter': '#666666',
  			// Couleurs legacy (pour compatibilité, à remplacer progressivement)
  			'brand-purple': '#fbbf1d', // Mappé vers yellow pour compatibilité
  			'brand-purple-dark': '#d4a017',
  			'brand-purple-light': '#fef3c7',
  			'brand-pink': '#45BF9A', // Mappé vers teal pour compatibilité
  			'brand-pink-dark': '#2d8f6f',
  			'brand-pink-light': '#d1fae5',
  			'gradient-start': '#fbbf1d',
  			'gradient-middle': '#45BF9A',
  			'gradient-end': '#333333',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			heading: ['var(--font-unbounded)', 'sans-serif'],
  			body: ['var(--font-zalando)', 'sans-serif'],
  		},
  		keyframes: {
  			'gradient-move': {
  				'0%': {
  					backgroundPosition: '0% 50%'
  				},
  				'50%': {
  					backgroundPosition: '100% 50%'
  				},
  				'100%': {
  					backgroundPosition: '0% 50%'
  				}
  			}
  		},
  		animation: {
  			'gradient-background': 'gradient-move 30s ease infinite'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
