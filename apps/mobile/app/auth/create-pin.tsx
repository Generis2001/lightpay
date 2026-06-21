import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PinInput } from '@/components/ui/PinInput';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';

export default function CreatePinScreen() {
  const [pin, setPin] = useState('');
  const { setPendingPin } = useAuthStore() as any;

  const handleComplete = (value: string) => {
    router.push({ pathname: '/auth/confirm-pin', params: { pin: value } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader />
      <View style={styles.content}>
        <Text style={styles.title}>Create your PIN</Text>
        <Text style={styles.subtitle}>
          Choose a 6-digit PIN to secure your account and authorize transactions.
        </Text>

        <View style={styles.securityNote}>
          <Text style={styles.securityText}>🔒 Never share your PIN with anyone</Text>
        </View>

        <PinInput
          value={pin}
          onChange={setPin}
          onComplete={handleComplete}
          label="Enter 6-digit PIN"
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
    lineHeight: 22,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  securityNote: {
    backgroundColor: Colors.brand.pale,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'stretch',
    marginBottom: 40,
  },
  securityText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.brand.dark,
  },
});
