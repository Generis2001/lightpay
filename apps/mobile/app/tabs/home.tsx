import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Eye,
  EyeSlash,
  PaperPlaneRight,
  ArrowCircleDown,
  Phone,
  WifiHigh,
  Lightning,
  QrCode,
  Plus,
  ArrowRight,
} from 'phosphor-react-native';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/wallet';
import { api } from '@/lib/api';
import { formatNaira, maskBalance, formatTransactionDateShort, getInitials } from '@/lib/format';
import type { TransactionListItem } from '@lightpay/types';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

const QUICK_ACTIONS = [
  { id: 'send', label: 'Send', icon: PaperPlaneRight, route: '/(modals)/send-money' },
  { id: 'receive', label: 'Receive', icon: ArrowCircleDown, route: '/(modals)/receive-money' },
  { id: 'airtime', label: 'Airtime', icon: Phone, route: '/(modals)/airtime' },
  { id: 'data', label: 'Data', icon: WifiHigh, route: '/(modals)/buy-data' },
  { id: 'bills', label: 'Pay Bills', icon: Lightning, route: '/(modals)/bills' },
  { id: 'qr', label: 'QR Pay', icon: QrCode, route: '/(modals)/qr-scan' },
];

const txTypeColors: Record<string, string> = {
  credit: Colors.brand.DEFAULT,
  transfer_in: Colors.brand.DEFAULT,
  debit: Colors.gray[700],
  transfer_out: Colors.gray[700],
  airtime: Colors.gray[700],
  data: Colors.gray[700],
  electricity: Colors.gray[700],
  cable: Colors.gray[700],
};

const txTypeIcons: Record<string, string> = {
  credit: '↓',
  transfer_in: '↓',
  debit: '↑',
  transfer_out: '↑',
  airtime: '📱',
  data: '📶',
  electricity: '⚡',
  cable: '📺',
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const {
    nairaWallet,
    virtualAccount,
    balanceVisible,
    toggleBalanceVisibility,
    setWallets,
    setVirtualAccount,
  } = useWalletStore();

  const { data: walletsData, refetch: refetchWallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      return data.data;
    },
  });

  const { data: accountData } = useQuery({
    queryKey: ['virtual-account'],
    queryFn: async () => {
      const { data } = await api.get('/wallets/virtual-account');
      return data.data;
    },
    enabled: !!nairaWallet,
  });

  const {
    data: transactionsData,
    refetch: refetchTx,
    isRefetching,
  } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/transactions?limit=5');
      return data.data;
    },
  });

  useEffect(() => {
    if (walletsData) setWallets(walletsData);
  }, [walletsData, setWallets]);

  useEffect(() => {
    if (accountData) setVirtualAccount(accountData);
  }, [accountData, setVirtualAccount]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchWallets(), refetchTx()]);
  }, [refetchWallets, refetchTx]);

  const handleCopyAccount = async () => {
    if (!virtualAccount) return;
    await Clipboard.setStringAsync(virtualAccount.accountNumber);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: 'Copied!', text2: 'Account number copied to clipboard' });
  };

  const recentTransactions: TransactionListItem[] = transactionsData?.data ?? [];
  const balance = nairaWallet?.balance ?? '0';
  const firstName = user?.firstName ?? 'there';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.DEFAULT}
            colors={[Colors.brand.DEFAULT]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user ? getInitials(`${user.firstName ?? ''} ${user.lastName ?? ''}`) : 'U'}
              </Text>
            </View>
            <View>
              <Text style={styles.greeting}>Good {getGreeting()},</Text>
              <Text style={styles.name}>{firstName} 👋</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push('/(modals)/notifications')}
          >
            <Bell size={22} color={Colors.ink.DEFAULT} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* Wallet Card */}
        <View style={styles.cardWrapper}>
          <LinearGradient
            colors={['#003D20', '#005828', '#00C853']}
            style={styles.walletCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardLabel}>Naira Wallet</Text>
                <Text style={styles.cardCurrency}>NGN</Text>
              </View>
              <TouchableOpacity
                onPress={toggleBalanceVisibility}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {balanceVisible ? (
                  <EyeSlash size={20} color="rgba(255,255,255,0.7)" />
                ) : (
                  <Eye size={20} color="rgba(255,255,255,0.7)" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.balanceRow}>
              <Text style={styles.balance}>
                {balanceVisible ? formatNaira(balance) : maskBalance(balance, 'NGN')}
              </Text>
            </View>

            {virtualAccount && (
              <TouchableOpacity style={styles.accountRow} onPress={handleCopyAccount}>
                <Text style={styles.accountNumber}>
                  {virtualAccount.accountNumber} • {virtualAccount.bankName}
                </Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </TouchableOpacity>
            )}

            {/* Decorative circles */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionTile}
                onPress={() => router.push(action.route as any)}
              >
                <View style={styles.actionIcon}>
                  <action.icon size={22} color={Colors.brand.DEFAULT} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Fund Wallet Banner */}
        <TouchableOpacity
          style={styles.fundBanner}
          onPress={() => router.push('/(modals)/receive-money')}
        >
          <View style={styles.fundBannerLeft}>
            <View style={styles.fundIcon}>
              <Plus size={18} color={Colors.brand.DEFAULT} weight="bold" />
            </View>
            <View>
              <Text style={styles.fundTitle}>Add Money</Text>
              <Text style={styles.fundSub}>Transfer to your account to fund wallet</Text>
            </View>
          </View>
          <ArrowRight size={18} color={Colors.gray[400]} />
        </TouchableOpacity>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transact')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySub}>Your transactions will appear here</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {recentTransactions.map((tx) => (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.txItem}
                  onPress={() =>
                    router.push({
                      pathname: '/(modals)/transaction-detail',
                      params: { id: tx.id },
                    })
                  }
                >
                  <View
                    style={[
                      styles.txIcon,
                      { backgroundColor: tx.isCredit ? Colors.brand.pale : Colors.gray[100] },
                    ]}
                  >
                    <Text style={styles.txIconText}>
                      {txTypeIcons[tx.type] ?? '💳'}
                    </Text>
                  </View>
                  <View style={styles.txMeta}>
                    <Text style={styles.txDescription} numberOfLines={1}>
                      {tx.description ?? formatTxType(tx.type)}
                    </Text>
                    <Text style={styles.txDate}>{formatTransactionDateShort(tx.createdAt)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.isCredit ? Colors.brand.DEFAULT : Colors.ink.DEFAULT },
                    ]}
                  >
                    {tx.isCredit ? '+' : '-'}
                    {formatNaira(tx.amount, true)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatTxType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.brand.DEFAULT,
  },
  greeting: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  name: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.semantic.error,
    borderWidth: 2,
    borderColor: Colors.gray[100],
  },

  // Wallet Card
  cardWrapper: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  walletCard: {
    borderRadius: 20,
    padding: 24,
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardCurrency: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.mono,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  balanceRow: {
    marginTop: 4,
    marginBottom: 20,
  },
  balance: {
    fontSize: 34,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
    letterSpacing: -1,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountNumber: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.mono,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  copyHint: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interRegular,
    color: 'rgba(255,255,255,0.5)',
  },
  decorCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 40,
    borderColor: 'rgba(255,255,255,0.05)',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 30,
    borderColor: 'rgba(255,255,255,0.04)',
    bottom: -30,
    right: 40,
  },

  // Quick Actions
  section: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionTile: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
  },

  // Fund Banner
  fundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.gray[100],
  },
  fundBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fundIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  fundSub: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginTop: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  seeAll: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.brand.DEFAULT,
  },

  // Transactions
  txList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconText: {
    fontSize: 20,
  },
  txMeta: {
    flex: 1,
  },
  txDescription: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
    marginBottom: 3,
  },
  txDate: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },
  txAmount: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
  },

  // Empty state
  emptyState: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  emptySub: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },

  bottomPad: { height: 32 },
});
