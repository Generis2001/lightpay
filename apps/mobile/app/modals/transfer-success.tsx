import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { formatNaira } from '@/lib/format';

export default function TransferSuccessScreen() {
  const params = useLocalSearchParams<{
    reference: string;
    accountName: string;
    bankName: string;
    amount: string;
  }>();

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const amountY = useSharedValue(20);
  const amountOpacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 300 });
    amountY.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 300 }));
    amountOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: amountY.value }],
    opacity: amountOpacity.value,
  }));

  const amount = parseFloat(params.amount ?? '0');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrapper, iconStyle]}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.textSection, amountStyle]}>
          <Text style={styles.successLabel}>Transfer Successful!</Text>
          <Text style={styles.amount}>{formatNaira(amount)}</Text>
          <Text style={styles.recipient}>
            Sent to <Text style={styles.recipientName}>{params.accountName}</Text>
          </Text>
          <Text style={styles.bank}>{params.bankName}</Text>
        </Animated.View>

        <View style={styles.referenceCard}>
          <Text style={styles.referenceLabel}>Transaction Reference</Text>
          <Text style={styles.reference}>{params.reference}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          title="Done"
          onPress={() => router.replace('/(tabs)/home')}
        />
        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => router.replace('/(tabs)/transact')}
        >
          <Text style={styles.historyLinkText}>View transaction history</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  iconWrapper: { marginBottom: 8 },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.DEFAULT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  checkMark: {
    fontSize: 44,
    color: Colors.white,
    fontFamily: FontFamily.jakartaBold,
    lineHeight: 52,
  },
  textSection: { alignItems: 'center', gap: 8 },
  successLabel: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.gray[700],
  },
  amount: {
    fontSize: 44,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
    letterSpacing: -2,
  },
  recipient: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    textAlign: 'center',
  },
  recipientName: {
    fontFamily: FontFamily.interSemiBold,
    color: Colors.ink.DEFAULT,
  },
  bank: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },

  referenceCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    alignSelf: 'stretch',
  },
  referenceLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reference: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.mono,
    color: Colors.gray[700],
    letterSpacing: 0.5,
  },

  actions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  historyLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  historyLinkText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.brand.DEFAULT,
  },
});
