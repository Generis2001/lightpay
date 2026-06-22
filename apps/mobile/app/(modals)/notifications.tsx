import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Info,
  CheckCircle,
} from 'phosphor-react-native';
import { api } from '../../lib/api';
import { Colors } from '../../constants/colors';

interface Notification {
  id: string;
  type: 'credit' | 'debit' | 'security' | 'info' | 'system';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, string>;
}

const NOTIF_META = {
  credit: { Icon: ArrowDownLeft, color: Colors.brand.DEFAULT },
  debit: { Icon: ArrowUpRight, color: '#EF4444' },
  security: { Icon: ShieldCheck, color: '#F59E0B' },
  info: { Icon: Info, color: '#3B82F6' },
  system: { Icon: Bell, color: '#6B7280' },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

// Placeholder notifications for dev
const PLACEHOLDER: Notification[] = [
  {
    id: '1',
    type: 'credit',
    title: 'Money Received',
    body: '₦5,000 from Adebayo Johnson has been credited to your wallet.',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    type: 'debit',
    title: 'Transfer Successful',
    body: '₦2,000 sent to GTBank — 0012345678. Reference: LP-NIP-XXXX.',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    type: 'security',
    title: 'New Device Login',
    body: "Your account was accessed from a new device. If this wasn't you, secure your account immediately.",
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: '4',
    type: 'info',
    title: 'Verify Your BVN',
    body: 'Increase your daily limit to ₦1,000,000 by verifying your BVN. It only takes 2 minutes.',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: '5',
    type: 'credit',
    title: 'Airtime Purchase Successful',
    body: '₦500 MTN airtime recharged to 08012345678.',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
];

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data: notifications = PLACEHOLDER, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const res = await api.get('/notifications');
        return res.data.data as Notification[];
      } catch {
        return PLACEHOLDER;
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View className="flex-1 bg-[#0A0A0F]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2">
          <Text className="text-white text-base font-['Inter_SemiBold']">Notifications</Text>
          {unreadCount > 0 && (
            <View className="bg-[#00C853] rounded-full w-5 h-5 items-center justify-center">
              <Text className="text-black text-xs font-['Inter_SemiBold']">{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <Text className="text-[#00C853] text-sm font-['Inter']">Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-16" />
        )}
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Bell size={56} color="rgba(255,255,255,0.15)" />
          <Text className="text-white text-lg font-['Inter_SemiBold'] mt-4">All caught up</Text>
          <Text className="text-white/50 text-sm font-['Inter'] text-center mt-2">
            You have no notifications yet. We'll let you know when something happens.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.brand.DEFAULT}
            />
          }
        >
          {notifications.map((notif, idx) => {
            const meta = NOTIF_META[notif.type] ?? NOTIF_META.info;
            return (
              <TouchableOpacity
                key={notif.id}
                onPress={() => {
                  if (!notif.isRead) markReadMutation.mutate(notif.id);
                }}
                className={`flex-row px-5 py-4 ${
                  !notif.isRead ? 'bg-[#1C1C2E]' : ''
                } ${idx > 0 ? 'border-t border-white/5' : ''}`}
              >
                {/* Unread indicator */}
                {!notif.isRead && (
                  <View className="w-2 h-2 rounded-full bg-[#00C853] mt-1 mr-3 self-start" />
                )}
                {notif.isRead && <View className="w-2 h-2 mt-1 mr-3" />}

                {/* Icon */}
                <View
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-3 flex-shrink-0"
                  style={{ backgroundColor: `${meta.color}20` }}
                >
                  <meta.Icon size={18} color={meta.color} />
                </View>

                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-start justify-between mb-0.5">
                    <Text className="text-white text-sm font-['Inter_SemiBold'] flex-1 mr-2">
                      {notif.title}
                    </Text>
                    <Text className="text-white/40 text-xs font-['Inter'] flex-shrink-0">
                      {timeAgo(notif.createdAt)}
                    </Text>
                  </View>
                  <Text className="text-white/60 text-sm font-['Inter'] leading-5">
                    {notif.body}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View className="h-8" />
        </ScrollView>
      )}
    </View>
  );
}
