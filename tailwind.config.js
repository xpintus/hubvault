const token = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: token('brand-50'), 100: token('brand-100'), 200: token('brand-200'),
          300: token('brand-300'), 400: token('brand-400'), 500: token('brand-500'),
          600: token('brand-600'), 700: token('brand-700'), 800: token('brand-800'),
          900: token('brand-900'), 950: token('brand-950'),
        },
        success: {
          50: token('success-50'), 100: token('success-100'), 200: token('success-200'),
          300: token('success-300'), 400: token('success-400'), 500: token('success-500'),
          600: token('success-600'), 700: token('success-700'), 800: token('success-800'),
          900: token('success-900'),
        },
        warning: {
          50: token('warning-50'), 100: token('warning-100'), 200: token('warning-200'),
          300: token('warning-300'), 400: token('warning-400'), 500: token('warning-500'),
          600: token('warning-600'), 700: token('warning-700'), 800: token('warning-800'),
          900: token('warning-900'),
        },
        error: {
          50: token('error-50'), 100: token('error-100'), 200: token('error-200'),
          300: token('error-300'), 400: token('error-400'), 500: token('error-500'),
          600: token('error-600'), 700: token('error-700'), 800: token('error-800'),
          900: token('error-900'),
        },
        neutral: {
          50: token('neutral-50'), 100: token('neutral-100'), 200: token('neutral-200'),
          300: token('neutral-300'), 400: token('neutral-400'), 500: token('neutral-500'),
          600: token('neutral-600'), 700: token('neutral-700'), 800: token('neutral-800'),
          900: token('neutral-900'), 950: token('neutral-950'),
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.03)',
        'card-hover': '0 4px 24px -4px rgb(var(--glow-rgb) / 0.12), 0 2px 8px -2px rgb(0 0 0 / 0.05)',
        'soft': '0 2px 8px -2px rgb(0 0 0 / 0.05), 0 1px 3px -1px rgb(0 0 0 / 0.03)',
        'soft-lg': '0 8px 24px -4px rgb(var(--glow-rgb) / 0.10), 0 4px 12px -2px rgb(0 0 0 / 0.05)',
        'glow': '0 0 0 1px rgb(var(--glow-rgb) / 0.12), 0 4px 20px -2px rgb(var(--glow-rgb) / 0.30)',
        'neon': '0 0 0 1px rgb(var(--glow-rgb) / 0.15), 0 4px 24px -2px rgb(var(--glow-rgb) / 0.40)',
        'dropdown': '0 12px 32px -8px rgb(var(--glow-rgb) / 0.18), 0 4px 12px -4px rgb(0 0 0 / 0.10)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-right': { '0%': { opacity: '0', transform: 'translateX(-12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'shimmer': { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
        'float-coin': {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '0.6' }, '90%': { opacity: '0.6' },
          '100%': { transform: 'translateY(-120px) rotate(20deg)', opacity: '0' },
        },
        'float-note': {
          '0%': { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: '0' },
          '15%': { opacity: '0.45' }, '85%': { opacity: '0.45' },
          '100%': { transform: 'translateY(-90px) translateX(30px) rotate(-15deg)', opacity: '0' },
        },
        'sway': { '0%, 100%': { transform: 'translateY(0) rotate(-3deg)' }, '50%': { transform: 'translateY(-14px) rotate(3deg)' } },
        'sway-reverse': { '0%, 100%': { transform: 'translateY(0) rotate(3deg)' }, '50%': { transform: 'translateY(-18px) rotate(-3deg)' } },
        'spin-slow': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        'count-up': { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgb(var(--glow-rgb) / 0.35), 0 0 24px rgb(var(--glow-rgb) / 0.18)' },
          '50%': { boxShadow: '0 0 20px rgb(var(--glow-rgb) / 0.55), 0 0 40px rgb(var(--glow-rgb) / 0.28)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'slide-down': 'slide-down 0.2s ease-out',
        'slide-right': 'slide-right 0.25s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
        'float-coin': 'float-coin 6s ease-in-out infinite',
        'float-note': 'float-note 7s ease-in-out infinite',
        'sway': 'sway 4s ease-in-out infinite',
        'sway-reverse': 'sway-reverse 5s ease-in-out infinite',
        'spin-slow': 'spin-slow 18s linear infinite',
        'count-up': 'count-up 0.4s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
