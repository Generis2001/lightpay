/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: '#00C853',
          dark: '#009624',
          light: '#5EFC82',
          pale: '#E8F5E9',
        },
        // Ink (neutral dark scale)
        ink: {
          DEFAULT: '#0A0A0F',
          dark: '#1A1A2E',
          card: '#1C1C2E',
          surface: '#2D2D44',
        },
        // Gray scale
        gray: {
          700: '#374151',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6',
          50: '#F9FAFB',
        },
        // Semantic
        success: '#00C853',
        warning: '#FFA726',
        error: '#EF4444',
        info: '#3B82F6',
        credit: '#00C853',
        // Crypto brand colors
        btc: '#F7931A',
        eth: '#627EEA',
        sol: '#9945FF',
        bnb: '#F3BA2F',
      },
      fontFamily: {
        'jakarta': ['PlusJakartaSans', 'sans-serif'],
        'jakarta-bold': ['PlusJakartaSans-Bold', 'sans-serif'],
        'jakarta-semibold': ['PlusJakartaSans-SemiBold', 'sans-serif'],
        'jakarta-medium': ['PlusJakartaSans-Medium', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'inter-medium': ['Inter-Medium', 'sans-serif'],
        'inter-semibold': ['Inter-SemiBold', 'sans-serif'],
        'mono': ['JetBrainsMono', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'DEFAULT': '12px',
        'lg': '16px',
        'xl': '20px',
        'full': '9999px',
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
      },
    },
  },
  plugins: [],
};
