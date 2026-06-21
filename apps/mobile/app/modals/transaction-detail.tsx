import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Lightning,
  WifiHigh,
  Phone,
  Television,
  X,
  ShareFat,
  CheckCircle,
  XCircle,
  Clock,
} from 'phosphor-react-native';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { Colors } from '../../constants/colors';

const TYPE_META: Record<string, { label: string; Icon: any; color: string }> = {
  transfer_out: { label: 'Transfer Sent', Icon: ArrowUpRight, color: '#EF4444' },
  transfer_in: { label: 'Transfer Received', Icon: ArrowDownLeft, color: '#00C853' },
  credit: { label: 'Money Received', Icon: ArrowDownLeft, color: '#00C853' },
  airtime: { label: 'Airtime', Icon: Phone, color: '#F59E0B' },
  data: { label: 'Data Bundle', Icon: WifiHigh, color: '#3B82F6' },
  electricity: { label: 'Electricity', Icon: Lightning, color: '#F59E0B' },
  cable: { label: 'Cable TV', Icon: Television, color: '#8B5CF6' },
};

const STATUS_META = {
  completed: { label: 'Successful', Icon: CheckCircle, color: '#00C853' },
  failed: { label: 'Failed', Icon: XCircle, color: '#EF4444' },
  pending: { label: 'Pending', Icon: Clock, color: '#F59E0B' },
  processing: { label: 'Processing', Icon: Clock, color: '#3B82F6' },
  reversed: { label: 'Reversed', Icon: XCircle, color: '#6B7280' },
};

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => api.get(`/transactions/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const handleShare = async () => {
    if (!tx) return;
    await Share.share({
      message: [
        `LightPay Transaction Receipt`,
        `Reference: ${tx.reference}`,
        `Type: ${TYPE_META[tx.type]?.label ?? tx.type}`,
        `Amount: ₦${formatCurrency(parseFloat(tx.amount))}`,
        `Status: ${STATUS_META[tx.status as keyof typeof STATUS_META]?.label ?? tx.status}`,
        `Date: ${new Date(tx.createdAt).toLocaleString('en-NG')}`,
      ].join('\n'),
    });
  };

  if (isLoading || !tx) {
    return (
      <View className="flex-1 bg-[#0A0A0F] items-center justify-center">
        <Text className="text-white/50 font-['Inter']">Loading transaction…</Text>
      </View>
    );
  }

  const typeMeta = TYPE_META[tx.type] ?? { label: tx.type, Icon: ArrowUpRight, color: '#6B7280' };
  const statusMeta = STATUS_META[tx.status as keyof typeof STATUS_META] ?? {
    label: tx.status,
    Icon: Clock,
    color: '#6B7280',
  };
  const isCredit = ['credit', 'transfer_in'].includes(tx.type);
  const amount = parseFloat(tx.amount);
  const fee = parseFloat(tx.fee ?? '0');

  return (
    <View className="flex-1 bg-[#0A0A0F]">
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-base font-['Inter_SemiBold']">Transaction Details</Text>
        <TouchableOpacity onPress={handleShare}>
          <ShareFat size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Amount hero */}
        <View className="items-center py-8 px-5">
          <View
            className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
            style={{ backgroundColor: `${typeMeta.color}20` }}
          >
            <typeMeta.Icon size={28} color={typeMeta.color} />
          </View>
          <Text className="text-white/60 text-sm font-['Inter'] mb-1">{typeMeta.label}</Text>
          <Text
            className="text-4xl font-['JetBrainsMono'] mb-3"
            style={{ color: isCredit ? Colors.brand.DEFAULT : '#FFFFFF' }}
          >
            {isCredit ? '+' : '-'}₦{formatCurrency(amount)}
          </Text>

          {/* Status badge */}
          <View
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ backgroundColor: `${statusMeta.color}20` }}
          >
            <statusMeta.Icon size={14} color={statusMeta.color} />
            <Text className="text-xs font-['Inter_Medium']" style={{ color: statusMeta.color }}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        {/* Details card */}
        <View className="mx-5 bg-[#1C1C2E] rounded-3xl overflow-hidden mb-4">
          {[
            { label: 'Reference', value: tx.reference, mono: true },
            { label: 'Date', value: new Date(tx.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) },
            tx.description && { label: 'Description', value: tx.description },
            tx.narration && { label: 'Narration', value: tx.narration },
            fee > 0 && { label: 'Fee', value: `₦${formatCurrency(fee)}` },
            fee > 0 && { label: 'Total Debited', value: `₦${formatCurrency(amount + fee)}` },
          ]
            .filter(Boolean)
            .map((item: any, idx, arr) => (
              <View
                key={item.label}
                className={`flex-row items-start justify-between px-5 py-4 ${
                  idx < arr.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <Text className="text-white/50 text-sm font-['Inter'] flex-1">{item.label}</Text>
                <Text
                  className={`text-sm flex-1 text-right ${
                    item.mono ? "font-['JetBrainsMono'] text-white/80" : "font-['Inter'] text-white"
                  }`}
                  selectable
                >
                  {item.value}
                </Text>
              </View>
            ))}
        </View>

        {/* Metadata (beneficiary, meter, etc.) */}
        {tx.metadata && Object.keys(tx.metadata).length > 0 && (
          <View className="mx-5 bg-[#1C1C2E] rounded-3xl overflow-hidden mb-4">
            <Text className="text-white/40 text-xs font-['Inter'] px-5 pt-4 pb-2 uppercase tracking-wider">
              Additional Info
            </Text>
            {Object.entries(tx.metadata).map(([key, value], idx, arr) => (
              <View
                key={key}
                className={`flex-row items-start justify-between px-5 py-3 ${
                  idx < arr.length - 1 ? 'border-b border-white/5' : 'pb-4'
                }`}
              >
                <Text className="text-white/50 text-sm font-['Inter'] capitalize flex-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Text>
                <Text className="text-white text-sm font-['Inter'] flex-1 text-right">
                  {String(value)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Balance snapshot */}
        <View className="mx-5 bg-[#1C1C2E] rounded-3xl overflow-hidden mb-8">
          <Text className="text-white/40 text-xs font-['Inter'] px-5 pt-4 pb-2 uppercase tracking-wider">
            Balance Snapshot
          </Text>
          <View className="flex-row px-5 pb-4 gap-6">
            <View className="flex-1">
              <Text className="text-white/50 text-xs font-['Inter'] mb-1">Before</Text>
              <Text className="text-white text-base font-['JetBrainsMono']">
                ₦{formatCurrency(parseFloat(tx.balanceBefore ?? '0'))}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white/50 text-xs font-['Inter'] mb-1">After</Text>
              <Text className="text-[#00C853] text-base font-['JetBrainsMono']">
                ₦{formatCurrency(parseFloat(tx.balanceAfter ?? '0'))}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
