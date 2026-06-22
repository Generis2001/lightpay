import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import Toast from 'react-native-toast-message';
import { Fingerprint } from 'phosphor-react-native';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

export default function SetupBiometricScreen() {
  const [supportsBiometric, setSupportsBiometric] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | null>(null);
  const [loading, setLoading] = useState(false);
  const { setBiometricEnabled } = useAuthStore();

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (hasHardware && isEnrolled) {
        setSupportsBiometric(true);
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else {
          setBiometricType('fingerprint');
        }
      }
    } catch (_) {
      // Biometrics not supported
    }
  };

  const handleEnableBiometric = async () => {
    setLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable fingerprint login',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        await api.post('/auth/biometric/enable', { deviceId: 'current' });
        setBiometricEnabled(true);
        Toast.show({ type: 'success', text1: 'Fingerprint enabled!', text2: 'You can now log in with your fingerprint' });
        router.replace('/(tabs)/home');
      } else {
        handleSkip();
      }
    } catch (_) {
      handleSkip();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)/home');
  };

  if (!supportsBiometric) {
    router.replace('/(tabs)/home');
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Fingerprint size={64} color={Colors.brand.DEFAULT} weight="thin" />
          </View>
        </View>

        <Text style={styles.title}>Enable{'\n'}Fingerprint Login</Text>
        <Text style={styles.subtitle}>
          Use your{' '}
          {biometricType === 'face' ? 'Face ID' : 'fingerprint'}{' '}
          to log in quickly and securely — no PIN needed every time.
        </Text>

        <View style={styles.benefits}>
          {['Fast & secure login', 'No more typing your PIN', 'Works offline too'].map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <Text style={styles.benefitCheck}>✓</Text>
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            title={`Enable ${biometricType === 'face' ? 'Face ID' : 'Fingerprint'}`}
            onPress={handleEnableBiometric}
            loading={loading}
          />
          <Button
            title="Maybe Later"
            onPress={handleSkip}
            variant="ghost"
            style={styles.skipButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
    gap: 24,
  },
  iconWrapper: {
    marginBottom: 8,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.h1,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  benefits: {
    alignSelf: 'stretch',
    gap: 12,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    padding: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitCheck: {
    fontSize: FontSize.bodyLg,
    color: Colors.brand.DEFAULT,
    fontFamily: FontFamily.jakartaBold,
  },
  benefitText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.ink.DEFAULT,
  },
  actions: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 'auto',
    marginBottom: 16,
  },
  skipButton: {
    height: 44,
  },
});
