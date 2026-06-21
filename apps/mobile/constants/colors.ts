export const Colors = {
  brand: {
    DEFAULT: '#00C853',
    dark: '#009624',
    light: '#5EFC82',
    pale: '#E8F5E9',
  },
  ink: {
    DEFAULT: '#0A0A0F',
    dark: '#1A1A2E',
    card: '#1C1C2E',
    surface: '#2D2D44',
  },
  gray: {
    700: '#374151',
    500: '#6B7280',
    400: '#9CA3AF',
    300: '#D1D5DB',
    200: '#E5E7EB',
    100: '#F3F4F6',
    50: '#F9FAFB',
  },
  semantic: {
    success: '#00C853',
    warning: '#FFA726',
    error: '#EF4444',
    info: '#3B82F6',
    credit: '#00C853',
  },
  crypto: {
    btc: '#F7931A',
    eth: '#627EEA',
    sol: '#9945FF',
    solGreen: '#14F195',
    bnb: '#F3BA2F',
  },
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const Gradients = {
  brand: ['#00C853', '#1DE9B6'] as const,
  dark: ['#0A0A0F', '#1A1A2E'] as const,
  card: ['#1A1A2E', '#2D2D44'] as const,
  sol: ['#9945FF', '#14F195'] as const,
  wallet: ['#0D1B2A', '#1A2F4A'] as const,
  nairaCard: ['#003D20', '#00C853'] as const,
  cryptoCard: ['#0D0D1A', '#1A0D2E'] as const,
} as const;
