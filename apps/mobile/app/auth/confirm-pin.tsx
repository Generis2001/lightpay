import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { PinInput } from '@/components/ui/PinInput';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';
import { api, getErrorMessage } from '@/lib/api';

export default function ConfirmPinScreen() {
  const { pin: originalPin } = useLocalSearchParams<{ pin: string }>();
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setTokens, setUser, setPinSet } = useAuthStore();

  const handleComplete = async (value: string) => {
    if (value !== originalPin) {
      setError(true);
      setConfirmPin('');
      Toast.show({ type: 'error', text1: 'PINs do not match', text2: 'Please try again' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/pin/set', { pin: value });
      setTokens(data.data.tokens.accessToken, data.data.tokens.refreshToken);
      setUser(data.data.user);
      setPinSet(true);
      router.push('/auth/setup-biometric');
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to set PIN', text2: getErrorMessage(error) });
      setConfirmPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader />
      <View style={styles.content}>
        <Text style={styles.title}>Confirm your PIN</Text>
        <Text style={styles.subtitle}>Enter the same 6-digit PIN to confirm.</Text>

        <PinInput
          value={confirmPin}
          onChange={(val) => {
            setConfirmPin(val);
            setError(false);
          }}
          onComplete={handleComplete}
          error={error}
          label="Re-enter your PIN"
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
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.h1,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    alignSelf: 'flex-start',
    marginBottom: 40,
  },
});
