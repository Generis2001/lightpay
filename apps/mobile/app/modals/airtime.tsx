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
import { useMutation } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useWalletStore } from '@/store/wallet';
import { useAuthStore } from '@/store/auth';
import { api, getErrorMessage } from '@/lib/api';
import { formatNaira } from '@/lib/format';

type Network = 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';

const NETWORKS: { id: Network; name: string; color: string; emoji: string }[] = [
  { id: 'MTN', name: 'MTN', color: '#FFCC00', emoji: '🟡' },
  { id: 'GLO', name: 'GLO', color: '#006837', emoji: '🟢' },
  { id: 'AIRTEL', name: 'Airtel', color: '#E40032', emoji: '🔴' },
  { id: '9MOBILE', name: '9mobile', color: '#006F3C', emoji: '🟩' },
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export default function AirtimeScreen() {
  const [network, setNetwork] = useState<Network>('MTN');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const { nairaWallet } = useWalletStore();
  const { user } = useAuthStore();

  const userPhone = user?.phone ?? '';

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/fiat/airtime', {
        walletId: nairaWallet?.id,
        network,
        phone: phone.startsWith('0') ? `+234${phone.slice(1)}` : phone,
        amount: parseFloat(amount),
        pin,
      });
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Airtime sent!', text2: `₦${amount} airtime to ${phone}` });
      router.back();
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Failed', text2: getErrorMessage(error) });
      setPin('');
      setShowPin(false);
    },
  });

  const handleContinue = () => {
    if (!phone || !amount || !network) return;
    setShowPin(true);
  };

  const handleSubmit = () => {
    if (!pin || pin.length < 6) return;
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Buy Airtime" closeMode />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Select Network</Text>
          <View style={styles.networkRow}>
            {NETWORKS.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.networkTile, network === n.id && styles.networkTileActive]}
                onPress={() => setNetwork(n.id)}
              >
                <Text style={styles.networkEmoji}>{n.emoji}</Text>
                <Text style={[styles.networkName, network === n.id && styles.networkNameActive]}>
                  {n.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Phone Number"
            placeholder="08012345678"
            keyboardType="phone-pad"
            maxLength={11}
            value={phone}
            onChangeText={setPhone}
            hint={userPhone ? undefined : undefined}
          />

          {userPhone && (
            <TouchableOpacity
              style={styles.selfRecharge}
              onPress={() => setPhone(userPhone.replace('+234', '0'))}
            >
              <Text style={styles.selfRechargeText}>Use my number ({userPhone.replace('+234', '0').slice(0, 4)}****)</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>Amount</Text>
          <View style={styles.quickAmountsGrid}>
            {QUICK_AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.amountChip, amount === a.toString() && styles.amountChipActive]}
                onPress={() => setAmount(a.toString())}
              >
                <Text style={[styles.amountChipText, amount === a.toString() && styles.amountChipTextActive]}>
                  ₦{a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input
            label="Or enter amount"
            placeholder="Enter amount"
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
            prefix={<Text style={styles.nairaSymbol}>₦</Text>}
          />

          {nairaWallet && (
            <Text style={styles.balanceHint}>Balance: {formatNaira(nairaWallet.balance)}</Text>
          )}

          {showPin && (
            <Input
              label="Enter Transaction PIN"
              placeholder="••••••"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              value={pin}
              onChangeText={setPin}
            />
          )}
        </ScrollView>

        <View style={styles.bottomAction}>
          {!showPin ? (
            <Button
              title="Continue"
              onPress={handleContinue}
              disabled={!phone || phone.length < 11 || !amount || !network}
            />
          ) : (
            <Button
              title={mutation.isPending ? 'Processing...' : `Pay ₦${amount}`}
              onPress={handleSubmit}
              loading={mutation.isPending}
              disabled={pin.length < 6}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 16 },
  sectionLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  networkRow: { flexDirection: 'row', gap: 10 },
  networkTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.transparent,
  },
  networkTileActive: {
    backgroundColor: Colors.brand.pale,
    borderColor: Colors.brand.DEFAULT,
  },
  networkEmoji: { fontSize: 24 },
  networkName: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[700],
  },
  networkNameActive: { color: Colors.brand.dark, fontFamily: FontFamily.interSemiBold },
  selfRecharge: {
    marginTop: -8,
    alignSelf: 'flex-start',
  },
  selfRechargeText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.brand.DEFAULT,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    borderWidth: 1.5,
    borderColor: Colors.transparent,
  },
  amountChipActive: {
    backgroundColor: Colors.brand.pale,
    borderColor: Colors.brand.DEFAULT,
  },
  amountChipText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[700],
  },
  amountChipTextActive: { color: Colors.brand.dark },
  nairaSymbol: { fontSize: FontSize.bodyLg, color: Colors.gray[500] },
  balanceHint: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
    marginTop: -8,
  },
  bottomAction: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
});
