import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, Star, UserCircle } from 'phosphor-react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useWalletStore } from '@/store/wallet';
import { api } from '@/lib/api';
import { formatNaira, getInitials } from '@/lib/format';
import type { Bank, ResolvedBankAccount, Beneficiary } from '@lightpay/types';

type SendStep = 'recipient' | 'amount';

export default function SendMoneyScreen() {
  const [step, setStep] = useState<SendStep>('recipient');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedAccount, setResolvedAccount] = useState<ResolvedBankAccount | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const { nairaWallet, beneficiaries } = useWalletStore();

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data } = await api.get('/transfers/banks');
      return data.data;
    },
    staleTime: Infinity,
  });

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const favourites = beneficiaries.filter((b) => b.isFavourite && b.type === 'bank').slice(0, 4);
  const recentBeneficiaries = beneficiaries.filter((b) => b.type === 'bank').slice(0, 6);

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const resolveAccount = useCallback((accNum: string, bCode: string) => {
    if (accNum.length !== 10 || !bCode) return;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setResolving(true);
      setResolveError(null);
      setResolvedAccount(null);
      try {
        const { data } = await api.get(
          `/transfers/resolve?accountNumber=${accNum}&bankCode=${bCode}`,
        );
        setResolvedAccount(data.data);
      } catch {
        setResolveError('Could not verify account. Check the details and try again.');
      } finally {
        setResolving(false);
      }
    }, 800);
  }, []);

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      resolveAccount(accountNumber, bankCode);
    } else {
      setResolvedAccount(null);
      setResolveError(null);
    }
  }, [accountNumber, bankCode, resolveAccount]);

  const handleSelectBeneficiary = (b: Beneficiary) => {
    setBankCode(b.bankCode ?? '');
    setAccountNumber(b.accountNumber ?? '');
    setSelectedBank({ code: b.bankCode ?? '', name: b.bankName ?? '' });
    setResolvedAccount({
      accountName: b.name,
      accountNumber: b.accountNumber ?? '',
      bankCode: b.bankCode ?? '',
      bankName: b.bankName ?? '',
    });
    setStep('amount');
  };

  const handleContinue = () => {
    if (!resolvedAccount) return;
    setStep('amount');
  };

  const handleProceed = () => {
    if (!resolvedAccount || !amount) return;
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    router.push({
      pathname: '/(modals)/confirm-transfer',
      params: {
        bankCode: resolvedAccount.bankCode,
        bankName: resolvedAccount.bankName,
        accountNumber: resolvedAccount.accountNumber,
        accountName: resolvedAccount.accountName,
        amount: parsedAmount.toString(),
        narration,
        walletId: nairaWallet?.id ?? '',
      },
    });
  };

  const formatAmountInput = (val: string) => {
    const digits = val.replace(/[^\d]/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10);
    return num.toLocaleString('en-NG');
  };

  if (step === 'amount') {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader
          title="Send Money"
          onBack={() => setStep('recipient')}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Recipient card */}
            <View style={styles.recipientCard}>
              <View style={styles.recipientAvatar}>
                <Text style={styles.recipientInitials}>
                  {getInitials(resolvedAccount?.accountName ?? '?')}
                </Text>
              </View>
              <View style={styles.recipientInfo}>
                <Text style={styles.recipientName}>{resolvedAccount?.accountName}</Text>
                <Text style={styles.recipientBank}>
                  {resolvedAccount?.accountNumber} • {resolvedAccount?.bankName}
                </Text>
              </View>
            </View>

            {/* Amount input — Cash App-inspired large number display */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>How much?</Text>
              <View style={styles.amountInputWrapper}>
                <Text style={styles.currencySymbol}>₦</Text>
                <Text style={[styles.amountDisplay, !amount && styles.amountPlaceholder]}>
                  {amount || '0'}
                </Text>
              </View>

              <View style={styles.quickAmounts}>
                {[1000, 2000, 5000, 10000, 20000, 50000].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={styles.quickAmount}
                    onPress={() => setAmount(preset.toLocaleString('en-NG'))}
                  >
                    <Text style={styles.quickAmountText}>₦{preset >= 1000 ? `${preset / 1000}k` : preset}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Inline numeric keypad */}
              <View style={styles.numpad}>
                {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.numpadKey}
                    onPress={() => {
                      if (key === '⌫') {
                        const raw = amount.replace(/,/g, '');
                        setAmount(formatAmountInput(raw.slice(0, -1)));
                      } else if (key === '.') {
                        // Allow decimal
                        if (!amount.includes('.')) setAmount(amount + '.');
                      } else {
                        const raw = (amount.replace(/,/g, '') + key).replace(/^0+(?=\d)/, '');
                        setAmount(formatAmountInput(raw));
                      }
                    }}
                  >
                    <Text style={styles.numpadKeyText}>{key}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Add note (optional)"
                placeholder="e.g. Payment for rent"
                value={narration}
                onChangeText={setNarration}
                containerStyle={styles.narrationInput}
              />

              {nairaWallet && (
                <Text style={styles.balanceHint}>
                  Balance: {formatNaira(nairaWallet.balance)}
                </Text>
              )}
            </View>
          </ScrollView>
          <View style={styles.bottomAction}>
            <Button
              title={amount ? `Send ${formatNaira(parseFloat(amount.replace(/,/g, '') || '0'))}` : 'Enter amount'}
              onPress={handleProceed}
              disabled={!amount || parseFloat(amount.replace(/,/g, '')) <= 0}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Send Money" closeMode />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Bank & Account inputs */}
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={styles.bankSelector}
            onPress={() => setShowBankPicker(true)}
          >
            <Text style={[styles.bankSelectorText, !selectedBank && styles.bankSelectorPlaceholder]}>
              {selectedBank?.name ?? 'Select bank'}
            </Text>
            <Text style={styles.bankSelectorArrow}>›</Text>
          </TouchableOpacity>

          <Input
            label="Account Number"
            placeholder="0000000000"
            keyboardType="number-pad"
            maxLength={10}
            value={accountNumber}
            onChangeText={setAccountNumber}
            suffix={resolving ? <ActivityIndicator size="small" color={Colors.brand.DEFAULT} /> : undefined}
            error={resolveError ?? undefined}
          />

          {resolvedAccount && (
            <View style={styles.resolvedCard}>
              <View style={styles.resolvedDot} />
              <Text style={styles.resolvedName}>{resolvedAccount.accountName}</Text>
            </View>
          )}
        </View>

        {resolvedAccount && (
          <Button title="Continue" onPress={handleContinue} style={styles.continueBtn} />
        )}

        {/* Beneficiaries */}
        {favourites.length > 0 && (
          <View style={styles.benefSection}>
            <Text style={styles.benefTitle}>Favourites</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.benefScroll}>
              {favourites.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.benefChip}
                  onPress={() => handleSelectBeneficiary(b)}
                >
                  <View style={styles.benefAvatar}>
                    <Text style={styles.benefInitials}>{getInitials(b.name)}</Text>
                  </View>
                  <Text style={styles.benefName} numberOfLines={1}>{b.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {recentBeneficiaries.length > 0 && (
          <View style={styles.benefSection}>
            <Text style={styles.benefTitle}>Recent</Text>
            {recentBeneficiaries.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.benefRow}
                onPress={() => handleSelectBeneficiary(b)}
              >
                <View style={styles.benefAvatarSm}>
                  <Text style={styles.benefInitialsSm}>{getInitials(b.name)}</Text>
                </View>
                <View style={styles.benefRowInfo}>
                  <Text style={styles.benefRowName}>{b.name}</Text>
                  <Text style={styles.benefRowSub}>{b.accountNumber} • {b.bankName}</Text>
                </View>
                {b.lastAmount && (
                  <Text style={styles.benefLastAmount}>{formatNaira(b.lastAmount, true)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bank picker modal */}
      {showBankPicker && (
        <View style={styles.bankPickerOverlay}>
          <View style={styles.bankPickerSheet}>
            <Text style={styles.bankPickerTitle}>Select Bank</Text>
            <Input
              placeholder="Search banks..."
              value={bankSearch}
              onChangeText={setBankSearch}
              prefix={<MagnifyingGlass size={18} color={Colors.gray[400]} />}
              containerStyle={styles.bankSearchInput}
            />
            <ScrollView style={styles.bankList}>
              {filteredBanks.map((bank) => (
                <TouchableOpacity
                  key={bank.code}
                  style={[styles.bankItem, selectedBank?.code === bank.code && styles.bankItemSelected]}
                  onPress={() => {
                    setSelectedBank(bank);
                    setBankCode(bank.code);
                    setShowBankPicker(false);
                    setBankSearch('');
                  }}
                >
                  <Text style={[styles.bankItemText, selectedBank?.code === bank.code && styles.bankItemTextSelected]}>
                    {bank.name}
                  </Text>
                  {selectedBank?.code === bank.code && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => { setShowBankPicker(false); setBankSearch(''); }}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 16 },

  inputGroup: { gap: 12 },
  bankSelector: {
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankSelectorText: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.interRegular,
    color: Colors.ink.DEFAULT,
  },
  bankSelectorPlaceholder: { color: Colors.gray[400] },
  bankSelectorArrow: {
    fontSize: 22,
    color: Colors.gray[400],
    lineHeight: 24,
  },
  resolvedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.brand.pale,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resolvedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand.DEFAULT,
  },
  resolvedName: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.brand.dark,
  },
  continueBtn: { marginTop: 4 },

  benefSection: { gap: 8 },
  benefTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  benefScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  benefChip: {
    alignItems: 'center',
    gap: 6,
    marginRight: 16,
    width: 64,
  },
  benefAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefInitials: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.brand.DEFAULT,
  },
  benefName: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
    textAlign: 'center',
  },
  benefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    gap: 12,
  },
  benefAvatarSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefInitialsSm: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.brand.DEFAULT,
  },
  benefRowInfo: { flex: 1 },
  benefRowName: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
  },
  benefRowSub: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
    marginTop: 2,
  },
  benefLastAmount: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.gray[700],
  },

  // Amount screen
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    padding: 16,
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientInitials: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.brand.DEFAULT,
  },
  recipientInfo: { flex: 1 },
  recipientName: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  recipientBank: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginTop: 2,
  },

  amountSection: { alignItems: 'center', gap: 16 },
  amountLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 32,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.gray[400],
  },
  amountDisplay: {
    fontSize: 48,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
    letterSpacing: -2,
  },
  amountPlaceholder: { color: Colors.gray[300] },

  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  quickAmount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
  },
  quickAmountText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[700],
  },

  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 8,
  },
  numpadKey: {
    width: '31%',
    flexGrow: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadKeyText: {
    fontSize: 22,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },

  narrationInput: { alignSelf: 'stretch' },
  balanceHint: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },

  bottomAction: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },

  // Bank picker
  bankPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  bankPickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  bankPickerTitle: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
    marginBottom: 16,
    textAlign: 'center',
  },
  bankSearchInput: { marginBottom: 8 },
  bankList: { maxHeight: 380 },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  bankItemSelected: { backgroundColor: Colors.brand.pale, borderRadius: 10, paddingHorizontal: 12 },
  bankItemText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.ink.DEFAULT,
  },
  bankItemTextSelected: {
    fontFamily: FontFamily.interSemiBold,
    color: Colors.brand.dark,
  },
  checkmark: {
    fontSize: FontSize.bodyLg,
    color: Colors.brand.DEFAULT,
    fontFamily: FontFamily.jakartaBold,
  },
});
