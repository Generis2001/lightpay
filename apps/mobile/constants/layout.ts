import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const Layout = {
  screenWidth: width,
  screenHeight: height,
  isSmallDevice: width < 375,
  padding: {
    screen: 20,
    card: 20,
    section: 16,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
  },
  button: {
    height: 56,
    heightSm: 44,
  },
  input: {
    height: 56,
  },
  tabBar: {
    height: 64,
  },
  header: {
    height: 56,
  },
  avatar: {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  },
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
} as const;
