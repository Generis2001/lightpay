import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as LocalAuthentication from 'expo-local-authentication';
import Toast from 'react-native-toast-message';
import { Fingerprint } from 'phosphor-react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';
import { api, getErrorMessage } from '@/lib/api';

type AuthMethod = 'phone' | 'email';

const phoneSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
});

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type EmailForm = z.infer<typeof emailSchema>;

export default function LoginScreen() {
  const [method, setMethod] = useState<AuthMethod>('phone');
  const [loading, setLoading] = useState(false);
  const { setPendingPhone, setPendingEmail, setAuthMethod, hasBiometric, user } = useAuthStore();

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const handleBiometricLogin = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Toast.show({ type: 'info', text1: 'Biometric not available', text2: 'Please use your PIN instead' });
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access LightPay',
        cancelLabel: 'Use PIN instead',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        router.replace('/(tabs)/home');
      } else if (result.error === 'user_cancel') {
        // User chose PIN
      } else {
        Toast.show({ type: 'error', text1: 'Authentication failed', text2: 'Please try again' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(error) });
    }
  };

  const handleSubmitPhone = async (data: PhoneForm) => {
    setLoading(true);
    try {
      let phone = data.phone.trim();
      if (phone.startsWith('0')) phone = `+234${phone.slice(1)}`;
      await api.post('/auth/login/request', { identifier: phone, method: 'phone' });
      setPendingPhone(phone);
      setAuthMethod('phone');
      router.push({ pathname: '/auth/verify-otp', params: { purpose: 'login' } });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Login Failed', text2: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEmail = async (data: EmailForm) => {
    setLoading(true);
    try {
      await api.post('/auth/login/request', {
        identifier: data.email.trim().toLowerCase(),
        method: 'email',
      });
      setPendingEmail(data.email.trim().toLowerCase());
      setAuthMethod('email');
      router.push({ pathname: '/auth/verify-otp', params: { purpose: 'login' } });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Login Failed', text2: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your LightPay account.</Text>

          {hasBiometric && (
            <TouchableOpacity style={styles.biometricCard} onPress={handleBiometricLogin}>
              <View style={styles.biometricIcon}>
                <Fingerprint size={28} color={Colors.brand.DEFAULT} weight="fill" />
              </View>
              <View style={styles.biometricText}>
                <Text style={styles.biometricTitle}>Use Fingerprint</Text>
                <Text style={styles.biometricSub}>Quick and secure sign in</Text>
              </View>
            </TouchableOpacity>
          )}

          {hasBiometric && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          <View style={styles.methodToggle}>
            <TouchableOpacity
              style={[styles.methodTab, method === 'phone' && styles.methodTabActive]}
              onPress={() => setMethod('phone')}
            >
              <Text style={[styles.methodTabText, method === 'phone' && styles.methodTabTextActive]}>
                Phone Number
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodTab, method === 'email' && styles.methodTabActive]}
              onPress={() => setMethod('email')}
            >
              <Text style={[styles.methodTabText, method === 'email' && styles.methodTabTextActive]}>
                Email
              </Text>
            </TouchableOpacity>
          </View>

          {method === 'phone' ? (
            <View style={styles.form}>
              <Controller
                control={phoneForm.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Input
                    label="Phone Number"
                    placeholder="08012345678"
                    keyboardType="phone-pad"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    prefix={<Text style={styles.flagPrefix}>🇳🇬</Text>}
                  />
                )}
              />
              <Button
                title="Send OTP"
                onPress={phoneForm.handleSubmit(handleSubmitPhone)}
                loading={loading}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Controller
                control={emailForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Input
                    label="Email Address"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Button
                title="Send OTP"
                onPress={emailForm.handleSubmit(handleSubmitEmail)}
                loading={loading}
              />
            </View>
          )}

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/register')}>
              <Text style={styles.signupLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 20,
  },
  title: {
    fontSize: FontSize.h1,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginTop: -8,
  },
  biometricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.brand.pale,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.brand.DEFAULT,
  },
  biometricIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricText: { flex: 1 },
  biometricTitle: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  biometricSub: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginTop: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: -4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.gray[200],
  },
  dividerText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[100],
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  methodTabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  methodTabText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  methodTabTextActive: {
    fontFamily: FontFamily.interSemiBold,
    color: Colors.ink.DEFAULT,
  },
  form: { gap: 16 },
  flagPrefix: { fontSize: 20 },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signupText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  signupLink: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interSemiBold,
    color: Colors.brand.DEFAULT,
  },
});
