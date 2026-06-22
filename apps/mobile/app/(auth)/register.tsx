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
import Toast from 'react-native-toast-message';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';
import { api, getErrorMessage } from '@/lib/api';

type AuthMethod = 'phone' | 'email';

const phoneSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number'),
  referralCode: z.string().optional(),
});

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  referralCode: z.string().optional(),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type EmailForm = z.infer<typeof emailSchema>;

export default function RegisterScreen() {
  const [method, setMethod] = useState<AuthMethod>('phone');
  const [loading, setLoading] = useState(false);
  const { setPendingPhone, setPendingEmail, setAuthMethod } = useAuthStore();

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '', referralCode: '' },
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', referralCode: '' },
  });

  const handleSubmitPhone = async (data: PhoneForm) => {
    setLoading(true);
    try {
      let phone = data.phone.trim();
      if (phone.startsWith('0')) {
        phone = `+234${phone.slice(1)}`;
      }
      await api.post('/auth/register/phone', { phone, referralCode: data.referralCode });
      setPendingPhone(phone);
      setPendingEmail(null);
      setAuthMethod('phone');
      router.push({ pathname: '/(auth)/verify-otp', params: { purpose: 'registration' } });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEmail = async (data: EmailForm) => {
    setLoading(true);
    try {
      await api.post('/auth/register/email', {
        email: data.email.trim().toLowerCase(),
        referralCode: data.referralCode,
      });
      setPendingEmail(data.email.trim().toLowerCase());
      setPendingPhone(null);
      setAuthMethod('email');
      router.push({ pathname: '/(auth)/verify-otp', params: { purpose: 'registration' } });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: getErrorMessage(error) });
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up with your phone number or email address.</Text>

          <View style={styles.methodToggle}>
            <TouchableOpacity
              style={[styles.methodTab, method === 'phone' && styles.methodTabActive]}
              onPress={() => setMethod('phone')}
            >
              <Text
                style={[styles.methodTabText, method === 'phone' && styles.methodTabTextActive]}
              >
                Phone Number
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodTab, method === 'email' && styles.methodTabActive]}
              onPress={() => setMethod('email')}
            >
              <Text
                style={[styles.methodTabText, method === 'email' && styles.methodTabTextActive]}
              >
                Email Address
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
                    required
                  />
                )}
              />
              <Controller
                control={phoneForm.control}
                name="referralCode"
                render={({ field, fieldState }) => (
                  <Input
                    label="Referral Code (Optional)"
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Button
                title="Continue"
                onPress={phoneForm.handleSubmit(handleSubmitPhone)}
                loading={loading}
                style={styles.submitButton}
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
                    autoComplete="email"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    required
                  />
                )}
              />
              <Controller
                control={emailForm.control}
                name="referralCode"
                render={({ field, fieldState }) => (
                  <Input
                    label="Referral Code (Optional)"
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Button
                title="Continue"
                onPress={emailForm.handleSubmit(handleSubmitEmail)}
                loading={loading}
                style={styles.submitButton}
              />
            </View>
          )}

          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>.
          </Text>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
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
    lineHeight: 22,
    marginTop: -8,
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
  submitButton: { marginTop: 8 },
  terms: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    lineHeight: 20,
    textAlign: 'center',
  },
  link: {
    color: Colors.brand.DEFAULT,
    fontFamily: FontFamily.interMedium,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  loginLink: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interSemiBold,
    color: Colors.brand.DEFAULT,
  },
});
