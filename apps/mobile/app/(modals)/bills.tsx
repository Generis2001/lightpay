import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Lightning, Television, CaretRight, CaretDown } from 'phosphor-react-native';
import { api } from '../../lib/api';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import PinInput from '../../components/ui/PinInput';
import { Colors } from '../../constants/colors';

type BillType = 'electricity' | 'cable';
type ElectricityStep = 'form' | 'verify' | 'pin';
type CableStep = 'provider' | 'plan' | 'card' | 'verify' | 'pin';

const DISCOS = [
  { id: 'EKEDC', name: 'Eko Electric (EKEDC)' },
  { id: 'IKEDC', name: 'Ikeja Electric (IKEDC)' },
  { id: 'AEDC', name: 'Abuja Electric (AEDC)' },
  { id: 'PHED', name: 'Port Harcourt (PHED)' },
  { id: 'KEDCO', name: 'Kano Electric (KEDCO)' },
  { id: 'EEDC', name: 'Enugu Electric (EEDC)' },
  { id: 'JED', name: 'Jos Electric (JED)' },
  { id: 'BEDC', name: 'Benin Electric (BEDC)' },
];

const CABLE_PROVIDERS = [
  { id: 'DSTV', name: 'DStv', color: '#0072BB' },
  { id: 'GOTV', name: 'GOtv', color: '#FF6B00' },
];

export default function BillsScreen() {
  const [billType, setBillType] = useState<BillType>('electricity');

  // Electricity state
  const [elecStep, setElecStep] = useState<ElectricityStep>('form');
  const [disco, setDisco] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [elecAmount, setElecAmount] = useState('');
  const [meterInfo, setMeterInfo] = useState<{ customerName: string; address: string } | null>(null);

  // Cable state
  const [cableStep, setCableStep] = useState<CableStep>('provider');
  const [provider, setProvider] = useState('');
  const [smartCard, setSmartCard] = useState('');
  const [selectedCablePlan, setSelectedCablePlan] = useState<{ code: string; name: string; amount: number } | null>(null);
  const [cableCustomer, setCableCustomer] = useState<{ customerName: string } | null>(null);

  // Shared
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showDiscos, setShowDiscos] = useState(false);

  const { data: cablePlans = [], isLoading: cablePlansLoading } = useQuery({
    queryKey: ['cable-plans', provider],
    queryFn: () =>
      api.get(`/bills/cable/plans?provider=${provider}`).then((r) => r.data.data),
    enabled: !!provider,
  });

  const verifyMeterMutation = useMutation({
    mutationFn: () =>
      api
        .get(`/bills/electricity/verify-meter?meterNumber=${meterNumber}&disco=${disco}&meterType=${meterType}`)
        .then((r) => r.data.data),
    onSuccess: (data) => {
      setMeterInfo(data);
      setElecStep('verify');
    },
    onError: () => Alert.alert('Error', 'Could not verify meter number'),
  });

  const verifyCardMutation = useMutation({
    mutationFn: () =>
      api
        .get(`/bills/cable/verify-card?smartCardNumber=${smartCard}&provider=${provider}`)
        .then((r) => r.data.data),
    onSuccess: (data) => {
      setCableCustomer(data);
      setCableStep('verify');
    },
    onError: () => Alert.alert('Error', 'Could not verify smart card'),
  });

  const payElectricityMutation = useMutation({
    mutationFn: () =>
      api.post('/bills/electricity', {
        meterNumber,
        disco,
        meterType,
        amount: parseFloat(elecAmount),
        customerName: meterInfo?.customerName,
        pin,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(modals)/transfer-success');
    },
    onError: (err: any) => {
      setPinError(err.response?.data?.message ?? 'Payment failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const payCableMutation = useMutation({
    mutationFn: () =>
      api.post('/bills/cable', {
        provider,
        smartCardNumber: smartCard,
        planCode: selectedCablePlan?.code,
        amount: selectedCablePlan?.amount,
        customerName: cableCustomer?.customerName,
        pin,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(modals)/transfer-success');
    },
    onError: (err: any) => {
      setPinError(err.response?.data?.message ?? 'Payment failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleElecPinComplete = (value: string) => {
    setPin(value);
    if (value.length === 6) payElectricityMutation.mutate();
  };

  const handleCablePinComplete = (value: string) => {
    setPin(value);
    if (value.length === 6) payCableMutation.mutate();
  };

  const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

  return (
    <View className="flex-1 bg-[#0A0A0F]">
      <ScreenHeader
        title="Pay Bills"
        onBack={() => router.back()}
      />

      {/* Bill Type Toggle */}
      <View className="flex-row mx-5 mt-2 bg-[#1C1C2E] rounded-2xl p-1 mb-6">
        {[
          { id: 'electricity', label: 'Electricity', icon: Lightning },
          { id: 'cable', label: 'Cable TV', icon: Television },
        ].map(({ id, label, icon: Icon }) => (
          <TouchableOpacity
            key={id}
            onPress={() => {
              setBillType(id as BillType);
              setElecStep('form');
              setCableStep('provider');
              setPinError('');
            }}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl ${
              billType === id ? 'bg-[#00C853]' : ''
            }`}
          >
            <Icon size={16} color={billType === id ? '#000' : 'rgba(255,255,255,0.5)'} />
            <Text
              className={`text-sm font-['Inter_Medium'] ${
                billType === id ? 'text-black' : 'text-white/50'
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* ─── ELECTRICITY ─── */}
        {billType === 'electricity' && (
          <>
            {(elecStep === 'form' || elecStep === 'verify') && (
              <>
                {/* Disco picker */}
                <Text className="text-white/50 text-xs font-['Inter'] mb-2">
                  Distribution Company
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDiscos(!showDiscos)}
                  className="flex-row items-center justify-between bg-[#1C1C2E] rounded-2xl px-4 py-3.5 mb-3"
                >
                  <Text className={`font-['Inter'] ${disco ? 'text-white' : 'text-white/30'}`}>
                    {disco ? DISCOS.find((d) => d.id === disco)?.name : 'Select DISCO'}
                  </Text>
                  <CaretDown size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {showDiscos && (
                  <View className="bg-[#1C1C2E] rounded-2xl overflow-hidden mb-3">
                    {DISCOS.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        onPress={() => {
                          setDisco(d.id);
                          setShowDiscos(false);
                        }}
                        className="px-4 py-3 border-b border-white/5"
                      >
                        <Text className="text-white font-['Inter']">{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Meter type */}
                <View className="flex-row gap-3 mb-3">
                  {(['prepaid', 'postpaid'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setMeterType(type)}
                      className={`flex-1 py-3 rounded-2xl items-center border ${
                        meterType === type
                          ? 'border-[#00C853] bg-[#00C853]/10'
                          : 'border-white/10 bg-[#1C1C2E]'
                      }`}
                    >
                      <Text
                        className={`font-['Inter_Medium'] capitalize ${
                          meterType === type ? 'text-[#00C853]' : 'text-white/50'
                        }`}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Meter number */}
                <Text className="text-white/50 text-xs font-['Inter'] mb-2">Meter Number</Text>
                <TextInput
                  value={meterNumber}
                  onChangeText={setMeterNumber}
                  placeholder="Enter meter number"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  className="bg-[#1C1C2E] rounded-2xl px-4 py-3.5 text-white font-['Inter'] mb-4"
                />

                {/* Meter info */}
                {meterInfo && elecStep === 'verify' && (
                  <View className="bg-[#00C853]/10 border border-[#00C853]/30 rounded-2xl p-4 mb-4">
                    <Text className="text-[#00C853] text-xs font-['Inter'] mb-1">Customer Verified</Text>
                    <Text className="text-white font-['Inter_SemiBold']">{meterInfo.customerName}</Text>
                    <Text className="text-white/50 text-xs mt-0.5 font-['Inter']">{meterInfo.address}</Text>
                  </View>
                )}

                {/* Amount */}
                <Text className="text-white/50 text-xs font-['Inter'] mb-2">Amount (₦)</Text>
                <TextInput
                  value={elecAmount}
                  onChangeText={setElecAmount}
                  placeholder="Enter amount"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  className="bg-[#1C1C2E] rounded-2xl px-4 py-3.5 text-white font-['Inter'] mb-3"
                />

                {/* Quick amounts */}
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {QUICK_AMOUNTS.map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      onPress={() => setElecAmount(String(amt))}
                      className="bg-[#1C1C2E] rounded-xl px-3 py-2"
                    >
                      <Text className="text-white/70 text-sm font-['Inter']">
                        ₦{amt.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {elecStep === 'form' ? (
                  <Button
                    label={verifyMeterMutation.isPending ? 'Verifying...' : 'Verify Meter'}
                    onPress={() => {
                      if (!disco) return Alert.alert('Select DISCO', 'Please select your distribution company');
                      if (!meterNumber) return Alert.alert('Meter Number', 'Please enter your meter number');
                      verifyMeterMutation.mutate();
                    }}
                    isLoading={verifyMeterMutation.isPending}
                  />
                ) : (
                  <Button
                    label="Pay Electricity"
                    onPress={() => {
                      if (!elecAmount || parseFloat(elecAmount) < 500) {
                        return Alert.alert('Amount', 'Minimum amount is ₦500');
                      }
                      setElecStep('pin');
                    }}
                  />
                )}
              </>
            )}

            {elecStep === 'pin' && (
              <View className="items-center pt-4">
                <View className="bg-[#1C1C2E] rounded-3xl p-5 mb-6 w-full">
                  <Text className="text-white/50 text-xs font-['Inter']">Electricity Payment</Text>
                  <Text className="text-white text-lg font-['Inter_SemiBold'] mt-1">
                    {DISCOS.find((d) => d.id === disco)?.name}
                  </Text>
                  <Text className="text-white/50 text-sm font-['Inter']">
                    Meter: {meterNumber} · {meterInfo?.customerName}
                  </Text>
                  <Text className="text-[#00C853] text-2xl font-['JetBrainsMono'] mt-2">
                    ₦{parseFloat(elecAmount).toLocaleString()}
                  </Text>
                </View>
                <PinInput
                  onComplete={handleElecPinComplete}
                  error={pinError}
                  isLoading={payElectricityMutation.isPending}
                />
              </View>
            )}
          </>
        )}

        {/* ─── CABLE TV ─── */}
        {billType === 'cable' && (
          <>
            {cableStep === 'provider' && (
              <>
                <Text className="text-white/50 text-sm mb-4 font-['Inter']">
                  Select your cable provider
                </Text>
                {CABLE_PROVIDERS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setProvider(p.id);
                      Haptics.selectionAsync();
                      setCableStep('plan');
                    }}
                    className="flex-row items-center justify-between bg-[#1C1C2E] rounded-2xl px-5 py-4 mb-3"
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: p.color }}
                      >
                        <Text className="text-white font-bold text-xs">{p.name.slice(0, 2)}</Text>
                      </View>
                      <Text className="text-white text-base font-['Inter_Medium']">{p.name}</Text>
                    </View>
                    <CaretRight size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {cableStep === 'plan' && (
              <>
                <Text className="text-white/50 text-sm mb-4 font-['Inter']">Select a plan</Text>
                {cablePlansLoading ? (
                  <ActivityIndicator color={Colors.brand.DEFAULT} />
                ) : (
                  (cablePlans as any[]).map((plan) => (
                    <TouchableOpacity
                      key={plan.code}
                      onPress={() => {
                        setSelectedCablePlan(plan);
                        Haptics.selectionAsync();
                        setCableStep('card');
                      }}
                      className="flex-row items-center justify-between bg-[#1C1C2E] rounded-2xl px-5 py-4 mb-3"
                    >
                      <Text className="text-white text-base font-['Inter']">{plan.name}</Text>
                      <Text className="text-[#00C853] font-['Inter_SemiBold']">
                        ₦{plan.amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {cableStep === 'card' && (
              <>
                <View className="bg-[#1C1C2E] rounded-2xl p-4 mb-4">
                  <Text className="text-white/50 text-xs font-['Inter']">Selected Plan</Text>
                  <Text className="text-white font-['Inter_SemiBold']">{selectedCablePlan?.name}</Text>
                  <Text className="text-[#00C853] font-['Inter_SemiBold']">
                    ₦{selectedCablePlan?.amount.toLocaleString()}
                  </Text>
                </View>
                <Text className="text-white/50 text-xs font-['Inter'] mb-2">Smart Card Number</Text>
                <TextInput
                  value={smartCard}
                  onChangeText={setSmartCard}
                  placeholder="Enter smart card / IUC number"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  className="bg-[#1C1C2E] rounded-2xl px-4 py-3.5 text-white font-['Inter'] mb-6"
                />
                <Button
                  label={verifyCardMutation.isPending ? 'Verifying...' : 'Verify Card'}
                  onPress={() => {
                    if (!smartCard) return Alert.alert('Smart Card', 'Enter your smart card number');
                    verifyCardMutation.mutate();
                  }}
                  isLoading={verifyCardMutation.isPending}
                />
              </>
            )}

            {cableStep === 'verify' && (
              <>
                <View className="bg-[#00C853]/10 border border-[#00C853]/30 rounded-2xl p-4 mb-4">
                  <Text className="text-[#00C853] text-xs font-['Inter'] mb-1">Card Verified</Text>
                  <Text className="text-white font-['Inter_SemiBold']">{cableCustomer?.customerName}</Text>
                  <Text className="text-white/50 text-xs mt-0.5 font-['Inter']">Card: {smartCard}</Text>
                </View>
                <View className="bg-[#1C1C2E] rounded-2xl p-4 mb-6">
                  <Text className="text-white/50 text-xs font-['Inter']">Plan</Text>
                  <Text className="text-white font-['Inter_SemiBold']">{selectedCablePlan?.name}</Text>
                  <Text className="text-[#00C853] font-['Inter_SemiBold'] text-lg">
                    ₦{selectedCablePlan?.amount.toLocaleString()}
                  </Text>
                </View>
                <Button label="Pay Now" onPress={() => setCableStep('pin')} />
              </>
            )}

            {cableStep === 'pin' && (
              <View className="items-center pt-4">
                <View className="bg-[#1C1C2E] rounded-3xl p-5 mb-6 w-full">
                  <Text className="text-white/50 text-xs font-['Inter']">Cable TV Subscription</Text>
                  <Text className="text-white text-lg font-['Inter_SemiBold'] mt-1">
                    {provider} · {selectedCablePlan?.name}
                  </Text>
                  <Text className="text-white/50 text-sm font-['Inter']">{cableCustomer?.customerName}</Text>
                  <Text className="text-[#00C853] text-2xl font-['JetBrainsMono'] mt-2">
                    ₦{selectedCablePlan?.amount.toLocaleString()}
                  </Text>
                </View>
                <PinInput
                  onComplete={handleCablePinComplete}
                  error={pinError}
                  isLoading={payCableMutation.isPending}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
