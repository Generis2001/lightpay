import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { PinInput } from '@/components/ui/PinInput';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { api, getErrorMessage } from '@/lib/api';
import { formatNaira } from '@/lib/format';

export default function ConfirmTransferScreen() {
  const params = useLocalSearchParams<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: string;
    narration: string;
    walletId: string;
  }>();

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [step, setStep] = useState<'review' | 'pin'>('review');

  const amount = parseFloat(params.amount ?? '0');
  const fee = amount > 5000 ? 25 : amount > 0 ? 10.75 : 0;

  const mutation = useMutation({
    mutationFn: async (enteredPin: string) => {
      const { data } = await api.post('/fiat/transfer/bank', {
        walletId: params.walletId,
        bankCode: params.bankCode,
        accountNumber: params.accountNumber,
        accountName: params.accountName,
        amount,
        narration: params.narration,
        pin: enteredPin,
        saveBeneficiary: true,
      });
      return data.data;
    },
    onSuccess: (data) => {
      router.replace({
        pathname: '/(modals)/transfer-success',
        params: {
          reference: data.transaction.reference,
          accountName: params.accountName,
          bankName: params.bankName,
          amount: params.amount,
        },
      });
    },
    onError: (error) => {
      setPinError(true);
      setPin('');
      Toast.show({ type: 'error', text1: 'Transfer Failed', text2: getErrorMessage(error) });
    },
  });

  const handlePinComplete = (value: string) => {
    setPinError(false);
    mutation.mutate(value);
  };

  if (step === 'pin') {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Enter PIN" onBack={() => setStep('review')} />
        <View style={styles.pinContent}>
          <Text style={styles.pinSubtitle}>
            Authorise transfer of{' '}
            <Text style={styles.pinAmount}>{formatNaira(amount)}</Text>{' '}
            to {params.accountName}
          </Text>
          <PinInput
            value={pin}
            onChange={(val) => { setPin(val); setPinError(false); }}
            onComplete={handlePinComplete}
            error={pinError}
            label="Enter your 6-digit transaction PIN"
          />
          {mutation.isPending && (
            <Text style={styles.processingText}>Processing your transfer...</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Review Transfer" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transfer Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient</Text>
            <Text style={styles.detailValue}>{params.accountName}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Number</Text>
            <Text style={styles.detailValue}>{params.accountNumber}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bank</Text>
            <Text style={styles.detailValue}>{params.bankName}</Text>
          </View>
          <View style={styles.divider} />

          {params.narration ? (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Note</Text>
                <Text style={styles.detailValue}>{params.narration}</Text>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValueLg}>{formatNaira(amount)}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction Fee</Text>
            <Text style={styles.detailValue}>{formatNaira(fee)}</Text>
          </View>
          <View style={styles.divider} />

          <View style={[styles.detailRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Debit</Text>
            <Text style={styles.totalValue}>{formatNaira(amount + fee)}</Text>
          </View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            🔒 Your transfer is protected. Funds typically arrive within 30 seconds.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomAction}>
        <Button title="Confirm & Enter PIN" onPress={() => setStep('pin')} />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} style={styles.cancelBtn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 4,
  },
  cardTitle: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  detailValue: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interSemiBold,
    color: Colors.ink.DEFAULT,
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailValueLg: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
  },
  divider: { height: 1, backgroundColor: Colors.gray[100] },
  totalRow: { marginTop: 4 },
  totalLabel: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  totalValue: {
    fontSize: FontSize.h2,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.brand.DEFAULT,
  },
  note: {
    backgroundColor: Colors.brand.pale,
    borderRadius: 12,
    padding: 14,
  },
  noteText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.brand.dark,
    lineHeight: 20,
  },
  bottomAction: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    backgroundColor: Colors.white,
    gap: 4,
  },
  cancelBtn: { height: 40 },

  // PIN step
  pinContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
    gap: 24,
  },
  pinSubtitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  pinAmount: {
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
  },
  processingText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
    textAlign: 'center',
  },
});
