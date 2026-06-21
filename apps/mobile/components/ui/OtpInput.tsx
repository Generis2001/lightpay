import React, { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  autoFocus = true,
}) => {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [autoFocus]);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete?.(digits);
    }
  };

  return (
    <Pressable style={styles.container} onPress={() => inputRef.current?.focus()}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        caretHidden
        contextMenuHidden
      />
      <View style={styles.cells}>
        {Array.from({ length }).map((_, index) => {
          const char = value[index] ?? '';
          const isFocused = index === value.length && index < length;
          return (
            <View
              key={index}
              style={[
                styles.cell,
                isFocused && styles.cellFocused,
                char && styles.cellFilled,
                error && styles.cellError,
              ]}
            >
              {char ? (
                <View style={styles.dot} />
              ) : isFocused ? (
                <View style={styles.cursor} />
              ) : null}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  cells: {
    flexDirection: 'row',
    gap: 12,
  },
  cell: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.gray[300],
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFocused: {
    borderColor: Colors.brand.DEFAULT,
    backgroundColor: Colors.white,
  },
  cellFilled: {
    borderColor: Colors.brand.DEFAULT,
    backgroundColor: Colors.brand.pale,
  },
  cellError: {
    borderColor: Colors.semantic.error,
    backgroundColor: '#FEF2F2',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.ink.DEFAULT,
  },
  cursor: {
    width: 2,
    height: 24,
    backgroundColor: Colors.brand.DEFAULT,
  },
});
