import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OtpInput } from '@/components/ui/OtpInput';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';
import { api, getErrorMessage } from '@/lib/api';

const RESEND_COOLDOWN = 60;

export default function VerifyOtpScreen() {
  const { purpose } = useLocalSearchParams<{ purpose: 'registration' | 'login' }>();
  const { pendingPhone, pendingEmail, authMethod, setUser, setTokens, setPinSet } = useAuthStore();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  const identifier = authMethod === 'phone' ? pendingPhone : pendingEmail;
  const maskedIdentifier = identifier
    ? authMethod === 'phone'
      ? identifier.replace(/(\+234|0)(\d{4})\d{4}(\d{3})/, '$1$2****$3')
      : identifier.replace(/(.{2}).+(@.+)/, '$1****$2')
    : '';

  useEffect(() => {
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await api.post('/auth/otp/resend', { identifier, method: authMethod, purpose });
      setCooldown(RESEND_COOLDOWN);
      Toast.show({ type: 'success', text1: 'OTP Sent', text2: `Check your ${authMethod}` });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to resend', text2: getErrorMessage(error) });
    }
  };

  const handleVerify = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(false);
      try {
        const { data } = await api.post('/auth/otp/verify', {
          identifier,
          method: authMethod,
          code,
          purpose,
        });

        if (purpose === 'registration') {
          if (data.data.user) {
            setUser(data.data.user);
          }
          router.push('/(auth)/create-pin');
        } else {
          const { user, tokens } = data.data;
          setUser(user);
          setTokens(tokens.accessToken, tokens.refreshToken);
          if (user.hasPin) {
            router.replace('/(tabs)/home');
          } else {
            router.push('/(auth)/create-pin');
          }
        }
      } catch (error) {
        setError(true);
        setOtp('');
        Toast.show({ type: 'error', text1: 'Invalid OTP', text2: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    },
    [identifier, authMethod, purpose, setUser, setTokens]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader />
      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.identifier}>{maskedIdentifier}</Text>
        </Text>

        <View style={styles.otpWrapper}>
          <OtpInput
            value={otp}
            onChange={(val) => {
              setOtp(val);
              setError(false);
            }}
            onComplete={handleVerify}
            error={error}
            autoFocus
          />
        </View>

        {error && (
          <Text style={styles.errorText}>Incorrect code. Please try again.</Text>
        )}

        {loading && (
          <Text style={styles.verifyingText}>Verifying...</Text>
        )}

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
            <Text style={[styles.resendLink, cooldown > 0 && styles.resendDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title="Verify"
          onPress={() => handleVerify(otp)}
          loading={loading}
          disabled={otp.length < 6}
          style={styles.verifyButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 0,
  },
  title: {
    fontSize: FontSize.h1,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    lineHeight: 22,
    marginBottom: 40,
  },
  identifier: {
    fontFamily: FontFamily.interSemiBold,
    color: Colors.ink.DEFAULT,
  },
  otpWrapper: {
    marginBottom: 24,
  },
  errorText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.semantic.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  verifyingText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    textAlign: 'center',
    marginBottom: 16,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  resendText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  resendLink: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interSemiBold,
    color: Colors.brand.DEFAULT,
  },
  resendDisabled: {
    color: Colors.gray[400],
  },
  verifyButton: {
    marginTop: 'auto',
    marginBottom: 16,
  },
});
