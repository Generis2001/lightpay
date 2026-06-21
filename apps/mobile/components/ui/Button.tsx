import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
  fullWidth?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  haptic = true,
  fullWidth = true,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 400 });
  };

  const handlePress = () => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const isDisabled = disabled || loading;

  return (
    <AnimatedTouchable
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={1}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.brand.DEFAULT}
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },

  // Variants
  primary: {
    backgroundColor: Colors.brand.DEFAULT,
  },
  secondary: {
    backgroundColor: Colors.brand.pale,
    borderWidth: 1.5,
    borderColor: Colors.brand.DEFAULT,
  },
  ghost: {
    backgroundColor: Colors.transparent,
  },
  danger: {
    backgroundColor: Colors.semantic.error,
  },
  outline: {
    backgroundColor: Colors.transparent,
    borderWidth: 1.5,
    borderColor: Colors.gray[300],
  },

  // Sizes
  sm: { height: 40, paddingHorizontal: 16 },
  md: { height: 48, paddingHorizontal: 20 },
  lg: { height: 56, paddingHorizontal: 24 },

  // Disabled
  disabled: { opacity: 0.45 },

  // Text styles
  text: {
    letterSpacing: 0,
  },
  primaryText: {
    color: Colors.white,
    fontFamily: FontFamily.jakartaBold,
  },
  secondaryText: {
    color: Colors.brand.DEFAULT,
    fontFamily: FontFamily.jakartaSemiBold,
  },
  ghostText: {
    color: Colors.gray[700],
    fontFamily: FontFamily.interMedium,
  },
  dangerText: {
    color: Colors.white,
    fontFamily: FontFamily.jakartaBold,
  },
  outlineText: {
    color: Colors.gray[700],
    fontFamily: FontFamily.interMedium,
  },

  // Text sizes
  smText: { fontSize: FontSize.bodySm },
  mdText: { fontSize: FontSize.body },
  lgText: { fontSize: FontSize.bodyLg },
});
