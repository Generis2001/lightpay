import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Eye, EyeSlash } from 'phosphor-react-native';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  containerStyle?: ViewStyle;
  showPasswordToggle?: boolean;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      prefix,
      suffix,
      containerStyle,
      showPasswordToggle,
      required,
      secureTextEntry,
      style,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const isSecure = showPasswordToggle ? !isPasswordVisible : secureTextEntry;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        <View
          style={[
            styles.inputWrapper,
            isFocused && styles.focused,
            error ? styles.errorBorder : null,
          ]}
        >
          {prefix && <View style={styles.prefix}>{prefix}</View>}
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor={Colors.gray[400]}
            secureTextEntry={isSecure}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
          {showPasswordToggle && (
            <TouchableOpacity
              style={styles.suffix}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isPasswordVisible ? (
                <EyeSlash size={20} color={Colors.gray[400]} />
              ) : (
                <Eye size={20} color={Colors.gray[400]} />
              )}
            </TouchableOpacity>
          )}
          {suffix && !showPasswordToggle && <View style={styles.suffix}>{suffix}</View>}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[500],
    marginBottom: 6,
  },
  required: {
    color: Colors.semantic.error,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray[100],
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.transparent,
    height: 56,
    paddingHorizontal: 16,
  },
  focused: {
    borderColor: Colors.brand.DEFAULT,
    backgroundColor: Colors.white,
  },
  errorBorder: {
    borderColor: Colors.semantic.error,
  },
  input: {
    flex: 1,
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.interRegular,
    color: Colors.ink.DEFAULT,
    padding: 0,
  },
  prefix: {
    marginRight: 12,
  },
  suffix: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.semantic.error,
    marginTop: 4,
    marginLeft: 4,
  },
  hint: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginTop: 4,
    marginLeft: 4,
  },
});
