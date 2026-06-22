import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MagnifyingGlass, FunnelSimple } from 'phosphor-react-native';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { api } from '@/lib/api';
import { formatNaira, formatTransactionDate } from '@/lib/format';
import type { TransactionListItem, TransactionType } from '@lightpay/types';

const FILTERS: { id: TransactionType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'credit', label: 'Credit' },
  { id: 'debit', label: 'Debit' },
  { id: 'transfer_out', label: 'Transfers' },
  { id: 'airtime', label: 'Airtime' },
  { id: 'data', label: 'Data' },
  { id: 'electricity', label: 'Bills' },
];

const txTypeEmojis: Record<string, string> = {
  credit: '↓',
  transfer_in: '↓',
  debit: '↑',
  transfer_out: '↑',
  airtime: '📱',
  data: '📶',
  electricity: '⚡',
  cable: '📺',
  water: '💧',
};

export default function TransactScreen() {
  const [activeFilter, setActiveFilter] = useState<TransactionType | 'all'>('all');
  const [search, setSearch] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['transactions', activeFilter, search],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        limit: '20',
        ...(activeFilter !== 'all' && { type: activeFilter }),
        ...(search && { search }),
      });
      const { data } = await api.get(`/transactions?${params}`);
      return data.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const transactions = data?.pages.flatMap((p) => p.data) ?? [];

  const groupByDate = (txs: TransactionListItem[]) => {
    const groups: { date: string; items: TransactionListItem[] }[] = [];
    const seen = new Map<string, TransactionListItem[]>();
    txs.forEach((tx) => {
      const date = new Date(tx.createdAt).toDateString();
      if (!seen.has(date)) {
        seen.set(date, []);
        groups.push({ date, items: seen.get(date)! });
      }
      seen.get(date)!.push(tx);
    });
    return groups;
  };

  const grouped = groupByDate(transactions);

  type ListItem =
    | { type: 'header'; date: string }
    | { type: 'item'; tx: TransactionListItem };

  const flatList: ListItem[] = grouped.flatMap((g) => [
    { type: 'header' as const, date: g.date },
    ...g.items.map((tx) => ({ type: 'item' as const, tx })),
  ]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      const label =
        item.date === new Date().toDateString()
          ? 'Today'
          : item.date === new Date(Date.now() - 86400000).toDateString()
          ? 'Yesterday'
          : new Date(item.date).toLocaleDateString('en-NG', { month: 'long', day: 'numeric', year: 'numeric' });
      return <Text style={styles.dateHeader}>{label}</Text>;
    }

    const { tx } = item;
    return (
      <TouchableOpacity
        style={styles.txItem}
        onPress={() =>
          router.push({ pathname: '/(modals)/transaction-detail', params: { id: tx.id } })
        }
      >
        <View
          style={[
            styles.txIcon,
            { backgroundColor: tx.isCredit ? Colors.brand.pale : Colors.gray[100] },
          ]}
        >
          <Text style={styles.txIconText}>{txTypeEmojis[tx.type] ?? '💳'}</Text>
        </View>
        <View style={styles.txMeta}>
          <Text style={styles.txDesc} numberOfLines={1}>
            {tx.description ?? tx.type.replace(/_/g, ' ')}
          </Text>
          <View style={styles.txStatusRow}>
            <View
              style={[
                styles.txStatusBadge,
                tx.status === 'completed' ? styles.txBadgeSuccess : styles.txBadgePending,
              ]}
            >
              <Text
                style={[
                  styles.txStatusText,
                  tx.status === 'completed' ? styles.txStatusSuccess : styles.txStatusPending,
                ]}
              >
                {tx.status}
              </Text>
            </View>
            <Text style={styles.txTime}>
              {new Date(tx.createdAt).toLocaleTimeString('en-NG', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
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
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <MagnifyingGlass size={18} color={Colors.gray[400]} />
          <TextInput
            style={styles.searchText}
            placeholder="Search transactions..."
            placeholderTextColor={Colors.gray[400]}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={styles.filtersRow}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === item.id && styles.filterChipActive]}
              onPress={() => setActiveFilter(item.id)}
            >
              <Text
                style={[styles.filterChipText, activeFilter === item.id && styles.filterChipTextActive]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={flatList}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.type === 'header' ? `hdr-${item.date}` : item.tx.id
        }
        contentContainerStyle={styles.list}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        onRefresh={refetch}
        refreshing={isLoading}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No transactions</Text>
            <Text style={styles.emptySub}>Your transaction history will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: FontSize.h2,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.gray[100],
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  searchText: {
    flex: 1,
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.ink.DEFAULT,
  },
  filtersRow: { marginBottom: 4 },
  filtersList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
  },
  filterChipActive: { backgroundColor: Colors.brand.pale },
  filterChipText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[500],
  },
  filterChipTextActive: {
    color: Colors.brand.DEFAULT,
    fontFamily: FontFamily.interSemiBold,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  dateHeader: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interSemiBold,
    color: Colors.gray[400],
    letterSpacing: 0.3,
    paddingVertical: 10,
    paddingTop: 16,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
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
  txIconText: { fontSize: 18 },
  txMeta: { flex: 1 },
  txDesc: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
    marginBottom: 4,
  },
  txStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txBadgeSuccess: { backgroundColor: Colors.brand.pale },
  txBadgePending: { backgroundColor: '#FEF3C7' },
  txStatusText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interMedium,
    textTransform: 'capitalize',
  },
  txStatusSuccess: { color: Colors.brand.DEFAULT },
  txStatusPending: { color: '#D97706' },
  txTime: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },
  txAmount: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  emptySub: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },
});
