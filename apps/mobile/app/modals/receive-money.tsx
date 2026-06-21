import React, { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import ViewShot from 'react-native-view-shot';
import Toast from 'react-native-toast-message';
import { Copy, Share, QrCode } from 'phosphor-react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useWalletStore } from '@/store/wallet';
import { useAuthStore } from '@/store/auth';
import { formatAccountNumber } from '@/lib/format';

export default function ReceiveMoneyScreen() {
  const { virtualAccount } = useWalletStore();
  const { user } = useAuthStore();
  const cardRef = useRef<ViewShot>(null);

  const handleCopyAccount = async () => {
    if (!virtualAccount) return;
    await Clipboard.setStringAsync(virtualAccount.accountNumber);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: 'Copied!', text2: 'Account number copied' });
  };

  const handleShare = async () => {
    if (!virtualAccount) return;
    const text = `Pay me via LightPay!\n\nAccount Name: ${virtualAccount.accountName}\nAccount Number: ${virtualAccount.accountNumber}\nBank: ${virtualAccount.bankName}`;
    await Sharing.shareAsync('', { dialogTitle: 'Share account details', UTI: 'public.plain-text' });
  };

  const accountName = virtualAccount?.accountName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Receive Money" closeMode />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Share your account details to receive money from any Nigerian bank.
        </Text>

        <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.95 }}>
          <LinearGradient
            colors={['#003D20', '#005828', '#00C853']}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardHeader}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>L</Text>
              </View>
              <Text style={styles.logoName}>LightPay</Text>
            </View>

            <Text style={styles.cardLabel}>Account Name</Text>
            <Text style={styles.cardValue}>{accountName}</Text>

            <View style={styles.cardDivider} />

            <View style={styles.cardRow}>
              <View>
                <Text style={styles.cardLabel}>Account Number</Text>
                <Text style={styles.cardAccountNum}>
                  {virtualAccount ? formatAccountNumber(virtualAccount.accountNumber) : '—'}
                </Text>
              </View>
              <View>
                <Text style={styles.cardLabel}>Bank</Text>
                <Text style={styles.cardValue}>{virtualAccount?.bankName ?? '—'}</Text>
              </View>
            </View>

            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
          </LinearGradient>
        </ViewShot>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={handleCopyAccount}>
            <View style={styles.actionIcon}>
              <Copy size={22} color={Colors.brand.DEFAULT} />
            </View>
            <Text style={styles.actionLabel}>Copy Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={handleShare}>
            <View style={styles.actionIcon}>
              <Share size={22} color={Colors.brand.DEFAULT} />
            </View>
            <Text style={styles.actionLabel}>Share Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.action}
            onPress={() => Toast.show({ type: 'info', text1: 'QR coming soon' })}
          >
            <View style={styles.actionIcon}>
              <QrCode size={22} color={Colors.brand.DEFAULT} />
            </View>
            <Text style={styles.actionLabel}>Show QR</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 How to receive money</Text>
          <Text style={styles.infoText}>
            Share your account number and bank name. Anyone with a Nigerian bank account can
            transfer directly to your LightPay wallet. Money arrives in seconds.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 24,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    lineHeight: 22,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    fontSize: 14,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
  },
  logoName: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
  },
  cardLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interRegular,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.white,
    marginBottom: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardAccountNum: {
    fontSize: 22,
    fontFamily: FontFamily.mono,
    color: Colors.white,
    letterSpacing: 2,
  },
  decorCircle1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 36,
    borderColor: 'rgba(255,255,255,0.05)',
    top: -50,
    right: -30,
  },
  decorCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 25,
    borderColor: 'rgba(255,255,255,0.04)',
    bottom: -20,
    left: 40,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  action: {
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
  },

  infoBox: {
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  infoTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  infoText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    lineHeight: 20,
  },
});
