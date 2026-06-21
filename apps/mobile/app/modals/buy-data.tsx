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
import { Phone, WifiHigh, CaretLeft, CaretRight } from 'phosphor-react-native';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Button from '../../components/ui/Button';
import PinInput from '../../components/ui/PinInput';
import { Colors } from '../../constants/colors';

const NETWORKS = [
  { id: 'MTN', label: 'MTN', color: '#FFCC00', textColor: '#1A1A1A' },
  { id: 'GLO', label: 'GLO', color: '#007F3B', textColor: '#FFFFFF' },
  { id: 'AIRTEL', label: 'Airtel', color: '#E40000', textColor: '#FFFFFF' },
  { id: '9MOBILE', label: '9mobile', color: '#006C35', textColor: '#FFFFFF' },
];

type Step = 'network' | 'plan' | 'phone' | 'pin';

export default function BuyDataScreen() {
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('network');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ code: string; name: string; amount: number; validity: string; allowance: string } | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['data-plans', selectedNetwork],
    queryFn: () =>
      api.get(`/bills/data/plans?network=${selectedNetwork}`).then((r) => r.data.data),
    enabled: !!selectedNetwork,
  });

  const purchaseMutation = useMutation({
    mutationFn: () =>
      api.post('/bills/data', {
        network: selectedNetwork,
        phone,
        planCode: selectedPlan?.code,
        amount: selectedPlan?.amount,
        pin,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/modals/transfer-success' as any);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Data purchase failed';
      setPinError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleNetworkSelect = (network: string) => {
    setSelectedNetwork(network);
    Haptics.selectionAsync();
    setStep('plan');
  };

  const handlePlanSelect = (plan: typeof selectedPlan) => {
    setSelectedPlan(plan);
    Haptics.selectionAsync();
    setStep('phone');
  };

  const handlePhoneNext = () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }
    setStep('pin');
  };

  const handlePinComplete = (value: string) => {
    setPin(value);
    if (value.length === 6) {
      purchaseMutation.mutate();
    }
  };

  const networkObj = NETWORKS.find((n) => n.id === selectedNetwork);

  return (
    <View className="flex-1 bg-[#0A0A0F]">
      <ScreenHeader
        title="Buy Data"
        subtitle={
          step === 'plan' && selectedNetwork
            ? `${networkObj?.label} Plans`
            : step === 'phone'
            ? 'Enter Phone Number'
            : step === 'pin'
            ? 'Enter PIN'
            : 'Select Network'
        }
        onBack={
          step === 'network'
            ? () => router.back()
            : () => {
                if (step === 'plan') setStep('network');
                else if (step === 'phone') setStep('plan');
                else if (step === 'pin') setStep('phone');
              }
        }
      />

      {step === 'network' && (
        <View className="flex-1 px-5 pt-6">
          <Text className="text-white/50 text-sm mb-4 font-['Inter']">
            Select your network provider
          </Text>
          {NETWORKS.map((net) => (
            <TouchableOpacity
              key={net.id}
              onPress={() => handleNetworkSelect(net.id)}
              className="flex-row items-center justify-between bg-[#1C1C2E] rounded-2xl px-5 py-4 mb-3"
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: net.color }}
                >
                  <Text style={{ color: net.textColor }} className="font-bold text-xs">
                    {net.label.slice(0, 3).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-white text-base font-['Inter_Medium']">{net.label}</Text>
              </View>
              <CaretRight size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {step === 'plan' && (
        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          {plansLoading ? (
            <ActivityIndicator color={Colors.brand.DEFAULT} size="large" className="mt-10" />
          ) : (
            <>
              <Text className="text-white/50 text-sm mb-4 font-['Inter']">
                Choose a data bundle
              </Text>
              {(plans as any[]).map((plan) => (
                <TouchableOpacity
                  key={plan.code}
                  onPress={() => handlePlanSelect(plan)}
                  className="flex-row items-center justify-between bg-[#1C1C2E] rounded-2xl px-5 py-4 mb-3"
                >
                  <View>
                    <Text className="text-white text-base font-['Inter_SemiBold']">
                      {plan.allowance}
                    </Text>
                    <Text className="text-white/50 text-xs mt-0.5 font-['Inter']">
                      Valid for {plan.validity}
                    </Text>
                  </View>
                  <Text className="text-[#00C853] text-base font-['Inter_SemiBold']">
                    ₦{plan.amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {step === 'phone' && (
        <View className="flex-1 px-5 pt-6">
          <View className="bg-[#1C1C2E] rounded-3xl p-5 mb-6">
            <Text className="text-white/50 text-xs font-['Inter'] mb-1">Selected Plan</Text>
            <Text className="text-white text-lg font-['Inter_SemiBold']">
              {networkObj?.label} {selectedPlan?.allowance}
            </Text>
            <Text className="text-[#00C853] text-base font-['Inter_Medium'] mt-1">
              ₦{selectedPlan?.amount.toLocaleString()} · {selectedPlan?.validity}
            </Text>
          </View>

          <Text className="text-white/50 text-sm mb-3 font-['Inter']">Phone Number</Text>

          <View className="flex-row items-center bg-[#1C1C2E] rounded-2xl px-4 py-3 mb-4">
            <Phone size={20} color="rgba(255,255,255,0.5)" />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="08012345678"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="phone-pad"
              maxLength={14}
              className="flex-1 text-white text-base ml-3 font-['Inter']"
            />
          </View>

          <TouchableOpacity
            onPress={() => setPhone(user?.phone ?? '')}
            className="flex-row items-center gap-2 mb-8"
          >
            <WifiHigh size={16} color={Colors.brand.DEFAULT} />
            <Text className="text-[#00C853] text-sm font-['Inter']">Use my number</Text>
          </TouchableOpacity>

          <Button label="Continue" onPress={handlePhoneNext} />
        </View>
      )}

      {step === 'pin' && (
        <View className="flex-1 px-5 pt-6 items-center">
          <View className="bg-[#1C1C2E] rounded-3xl p-5 mb-8 w-full">
            <Text className="text-white/50 text-xs font-['Inter'] mb-1">Buying</Text>
            <Text className="text-white text-lg font-['Inter_SemiBold']">
              {networkObj?.label} {selectedPlan?.allowance} for {phone}
            </Text>
            <Text className="text-[#00C853] text-2xl font-['JetBrainsMono'] mt-2">
              ₦{selectedPlan?.amount.toLocaleString()}
            </Text>
          </View>

          <Text className="text-white/70 text-sm font-['Inter'] mb-6">
            Enter your 6-digit transaction PIN
          </Text>

          <PinInput
            onComplete={handlePinComplete}
            error={pinError}
            isLoading={purchaseMutation.isPending}
          />
        </View>
      )}
    </View>
  );
}
