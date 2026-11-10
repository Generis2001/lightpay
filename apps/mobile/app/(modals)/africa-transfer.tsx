import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { SettingsScreen, InfoCard } from '@/components/ui/SettingsScreen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PinInput } from '@/components/ui/PinInput';
import { api, getErrorMessage } from '@/lib/api';

export default function AfricaTransferScreen() {
  const queryClient = useQueryClient();
  const [country, setCountry] = useState('GH'); const [bank, setBank] = useState<any>();
  const [accountNumber, setAccountNumber] = useState(''); const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState(''); const [branchCode, setBranchCode] = useState('');
  const [quote, setQuote] = useState<any>(); const [pin, setPin] = useState('');
  const corridors = useQuery({ queryKey: ['bank-corridors'], queryFn: async () => (await api.get('/international/corridors')).data.data });
  const corridor = corridors.data?.find((c: any) => c.country === country);
  const banks = useQuery({ queryKey: ['international-banks', country], queryFn: async () => (await api.get('/international/banks', { params: { country } })).data.data, enabled: !!corridor?.enabled });
  const branches = useQuery({ queryKey: ['international-branches', bank?.id], queryFn: async () => (await api.get('/international/branches', { params: { bankId: bank.id } })).data.data, enabled: !!bank?.id });
  const estimate = useMutation({ mutationFn: async () => (await api.post('/international/quotes', { country, bankCode: bank.code, accountNumber, recipientName, amount: Number(amount), ...(branchCode ? { branchCode } : {}) })).data.data,
    onSuccess: (data) => { setQuote(data); setPin(''); }, onError: (error) => Toast.show({ type: 'error', text1: getErrorMessage(error) }),
  });
  const send = useMutation({ mutationFn: async (enteredPin: string) => (await api.post('/international/send', { quoteId: quote.id, pin: enteredPin })).data.data,
    onSuccess: (tx) => { queryClient.invalidateQueries({ queryKey: ['wallets'] }); queryClient.invalidateQueries({ queryKey: ['transactions'] }); router.replace({ pathname: '/(modals)/transfer-success', params: { transactionId: tx.id, reference: tx.reference, status: tx.status, currency: 'NGN', amount: tx.amount, accountName: recipientName, bankName: bank.name, kind: 'International bank transfer' } }); },
    onError: (error) => { setPin(''); Toast.show({ type: 'error', text1: getErrorMessage(error) }); },
  });
  return <SettingsScreen title="African bank transfer">
    <InfoCard title="Choose a bank corridor">Send NGN from your wallet. The recipient receives the local currency shown in your quote. Full identity verification is required.</InfoCard>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {corridors.data?.map((c: any) => <TouchableOpacity key={c.country} accessibilityRole="button" onPress={() => { setCountry(c.country); setBank(undefined); setBranchCode(''); setQuote(undefined); }} style={{ padding: 12, borderRadius: 12, backgroundColor: country === c.country ? '#005828' : '#FFFFFF' }}><Text style={{ color: country === c.country ? '#FFFFFF' : '#111111' }}>{c.name} · {c.currency}</Text></TouchableOpacity>)}
    </View>
    {!corridor?.enabled && <InfoCard title="Corridor setup pending">This country is not activated with the payment provider yet. Bank coverage and receiving currency will be shown after activation.</InfoCard>}
    {corridors.isError && <Button title="Retry country lookup" onPress={() => corridors.refetch()} />}
    {banks.isError && <Button title="Retry bank lookup" onPress={() => banks.refetch()} />}
    {banks.data?.map((b: any) => <TouchableOpacity key={b.id} accessibilityRole="button" onPress={() => { setBank(b); setBranchCode(''); setQuote(undefined); }} style={{ backgroundColor: bank?.id === b.id ? '#E1F5E7' : '#FFFFFF', padding: 12, borderRadius: 12 }}><Text>{b.name}</Text></TouchableOpacity>)}
    <Input label="Recipient account number" value={accountNumber} onChangeText={(v) => { setAccountNumber(v.trim()); setQuote(undefined); }} autoCapitalize="none" />
    <Input label="Recipient name" value={recipientName} onChangeText={(v) => { setRecipientName(v); setQuote(undefined); }} />
    {branches.data?.length > 0 && <View style={{ gap: 8 }}><Text>Choose the recipient’s bank branch</Text>{branches.data.map((b: any) => <TouchableOpacity key={b.id ?? b.branch_code} onPress={() => { setBranchCode(b.branch_code); setQuote(undefined); }}><Text>{branchCode === b.branch_code ? '✓ ' : ''}{b.branch_name ?? b.name} · {b.branch_code}</Text></TouchableOpacity>)}</View>}
    <Input label="Amount in NGN before fees" value={amount} keyboardType="decimal-pad" onChangeText={(v) => { setAmount(v); setQuote(undefined); }} />
    <Button title="Review rate and fee" disabled={!corridor?.enabled || !bank || !accountNumber || !recipientName.trim() || Number(amount) < 100 || !Number.isFinite(Number(amount))} loading={estimate.isPending} onPress={() => estimate.mutate()} />
    {quote && <>
      <InfoCard title="Review transfer">{`Recipient: ${recipientName}, ${accountNumber}, ${bank.name}. Amount: NGN ${quote.sourceAmount}. Fee: NGN ${quote.fee}. Recipient estimate: ${quote.destinationCurrency} ${quote.destinationAmount}. Rate is checked again before submission. Verify the entered recipient details.`}</InfoCard>
      <PinInput value={pin} onChange={setPin} disabled={send.isPending} onComplete={(value) => { if (!send.isPending) send.mutate(value); }} />
    </>}
  </SettingsScreen>;
}
