export const FontFamily = {
  jakartaRegular: 'PlusJakartaSans',
  jakartaMedium: 'PlusJakartaSans-Medium',
  jakartaSemiBold: 'PlusJakartaSans-SemiBold',
  jakartaBold: 'PlusJakartaSans-Bold',
  interRegular: 'Inter',
  interMedium: 'Inter-Medium',
  interSemiBold: 'Inter-SemiBold',
  mono: 'JetBrainsMono',
} as const;

export const FontSize = {
  displayXl: 48,
  displayL: 36,
  h1: 28,
  h2: 22,
  h3: 18,
  bodyLg: 16,
  body: 14,
  bodySm: 12,
  caption: 11,
} as const;

export const LineHeight = {
  displayXl: 56,
  displayL: 44,
  h1: 36,
  h2: 28,
  h3: 24,
  bodyLg: 24,
  body: 20,
  bodySm: 18,
  caption: 16,
} as const;

export const LetterSpacing = {
  tight: -1,
  snug: -0.5,
  normal: 0,
  wide: 0.2,
  mono: 0.4,
} as const;
