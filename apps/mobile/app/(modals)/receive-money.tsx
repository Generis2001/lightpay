import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share as NativeShare, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import * as Crypto from 'expo-crypto';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from '@/lib/haptics';
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
  const [showQr, setShowQr] = useState(false);
  const queryClient = useQueryClient();
  const [fundAmount, setFundAmount] = useState('');
  const [fundReference, setFundReference] = useState<string>();
  const fundingKey = useRef(Crypto.randomUUID());
  const accountQuery = useQuery({ queryKey: ['virtual-account'], queryFn: async () => (await api.get('/wallets/virtual-account')).data.data });
  useEffect(() => { if (accountQuery.data) useWalletStore.getState().setVirtualAccount(accountQuery.data); }, [accountQuery.data]);
  const provision = useMutation({ mutationFn: async () => (await api.post('/wallets/virtual-account')).data.data,
    onSuccess: (account) => { useWalletStore.getState().setVirtualAccount(account); queryClient.invalidateQueries({ queryKey: ['wallets'] }); },
    onError: (error) => Toast.show({ type: 'error', text1: 'Receiving account unavailable', text2: getErrorMessage(error) }),
  });
  const funding = useMutation({ mutationFn: async () => (await api.post('/wallets/funding', { amount: Number(fundAmount) }, { headers: { 'Idempotency-Key': fundingKey.current } })).data.data,
    onSuccess: async (intent) => {
      setFundReference(intent.reference);
      if (intent.checkoutUrl) {
        try { await Linking.openURL(intent.checkoutUrl); }
        catch { Toast.show({ type: 'error', text1: 'Could not open checkout', text2: 'Try continuing to card payment again.' }); }
      } else {
        Toast.show({ type: 'info', text1: 'Checkout confirmation pending', text2: 'Check funding status or contact support with your reference.' });
      }
    },
    onError: (error) => Toast.show({ type: 'error', text1: 'Funding unavailable', text2: getErrorMessage(error) }),
  });
  const fundingStatus = useQuery({ queryKey: ['funding', fundReference], queryFn: async () => (await api.get(`/wallets/funding/${fundReference}`)).data.data,
    enabled: !!fundReference, refetchInterval: (query) => query.state.data?.status === 'completed' ? false : 5000,
  });
  useEffect(() => { if (fundingStatus.data?.status === 'completed') { queryClient.invalidateQueries({ queryKey: ['wallets'] }); queryClient.invalidateQueries({ queryKey: ['transactions'] }); } }, [fundingStatus.data?.status]);

  const handleCopyAccount = async () => {
    if (!virtualAccount) return;
    await Clipboard.setStringAsync(virtualAccount.accountNumber);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: 'Copied!', text2: 'Account number copied' });
  };

  const handleShare = async () => {
    if (!virtualAccount) return;
    const text = `Pay me via LightPay!\n\nAccount Name: ${virtualAccount.accountName}\nAccount Number: ${virtualAccount.accountNumber}\nBank: ${virtualAccount.bankName}`;
    await NativeShare.share({ message: text });
  };

  const accountName = virtualAccount?.accountName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Receive Money" closeMode />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!virtualAccount && <View style={{ gap: 12 }}><Text style={styles.subtitle}>Create a receiving account after verifying your identity, email and full name.</Text><Button title="Create receiving account" loading={provision.isPending} onPress={() => provision.mutate()} /></View>}
        {accountQuery.isError && <Button title="Retry account lookup" variant="outline" onPress={() => accountQuery.refetch()} />}
        <View style={{ gap: 12 }}>
          <Input label="Fund with a card (NGN)" value={fundAmount} keyboardType="decimal-pad" onChangeText={(value) => { setFundAmount(value); fundingKey.current = Crypto.randomUUID(); setFundReference(undefined); }} />
          <Button title="Continue to card payment" loading={funding.isPending} disabled={!Number.isFinite(Number(fundAmount)) || Number(fundAmount) < 100} onPress={() => funding.mutate()} />
          {fundReference && <><Text selectable style={styles.subtitle}>Reference: {fundReference}</Text><Text style={styles.subtitle}>{fundingStatus.data?.status === 'completed' ? 'Funding received. Your wallet has been credited.' : fundingStatus.data?.checkoutUrl ? 'Complete payment in the browser, then return to LightPay. Your wallet updates after provider confirmation.' : 'Checkout is awaiting provider confirmation. Check status or contact support with this reference.'}</Text><Button title="Check funding status" variant="outline" onPress={() => fundingStatus.refetch()} /></>}
        </View>
        <Text style={styles.subtitle}>
          Share your account details to receive money from a supported Nigerian bank.
        </Text>

        <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.95 }}>
          <LinearGradient
            colors={['#003D20', '#005828', '#00C853']}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardHeader}>
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
          <TouchableOpacity style={styles.action} onPress={handleCopyAccount} disabled={!virtualAccount}>
            <View style={styles.actionIcon}>
              <Copy size={22} color={Colors.brand.DEFAULT} />
            </View>
            <Text style={styles.actionLabel}>Copy Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={handleShare} disabled={!virtualAccount}>
            <View style={styles.actionIcon}>
              <Share size={22} color={Colors.brand.DEFAULT} />
            </View>
            <Text style={styles.actionLabel}>Share Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.action}
            onPress={() => setShowQr(!showQr)}
            disabled={!virtualAccount}
          >
            <View style={styles.actionIcon}>
              <QrCode size={22} color={Colors.brand.DEFAULT} />
            </View>
            <Text style={styles.actionLabel}>Show QR</Text>
          </TouchableOpacity>
        </View>

        {showQr && virtualAccount && <View style={{ alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF', borderRadius: 16, gap: 12 }}>
          <QRCode size={220} value={JSON.stringify({ version: '1', type: 'lightpay_receive', accountNumber: virtualAccount.accountNumber, bankCode: virtualAccount.bankCode, name: virtualAccount.accountName })} />
          <Text style={styles.subtitle}>Scan in LightPay to fill in your bank details.</Text>
        </View>}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 How to receive money</Text>
          <Text style={styles.infoText}>
            Share your account number and bank name. Anyone with a Nigerian bank account can
            transfer directly to your LightPay wallet. Your wallet is credited after the bank confirms the deposit.
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
