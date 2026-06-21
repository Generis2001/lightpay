import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  label?: string;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
];

export const PinInput: React.FC<PinInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  label,
}) => {
  const shake = useSharedValue(0);

  useEffect(() => {
    if (error) {
      shake.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error, shake]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const handleKey = (key: string) => {
    if (key === 'del') {
      const newVal = value.slice(0, -1);
      onChange(newVal);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (key === '') return;
    if (value.length >= length) return;
    const newVal = value + key;
    onChange(newVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (newVal.length === length) {
      onComplete?.(newVal);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View style={[styles.dotsRow, animatedStyle]}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < value.length && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </Animated.View>

      <View style={styles.keypad}>
        {KEYS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key) => (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.key,
                  key === '' && styles.keyEmpty,
                  pressed && key !== '' && styles.keyPressed,
                ]}
                onPress={() => handleKey(key)}
                disabled={key === ''}
              >
                {key === 'del' ? (
                  <Text style={styles.keyDelete}>⌫</Text>
                ) : key === '' ? null : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  label: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginBottom: 24,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
  },
  dotFilled: {
    backgroundColor: Colors.brand.DEFAULT,
    borderColor: Colors.brand.DEFAULT,
  },
  dotError: {
    borderColor: Colors.semantic.error,
    backgroundColor: Colors.semantic.error,
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 64,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    backgroundColor: Colors.transparent,
  },
  keyPressed: {
    backgroundColor: Colors.gray[200],
  },
  keyText: {
    fontSize: 22,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  keyDelete: {
    fontSize: 22,
    color: Colors.gray[700],
  },
});
