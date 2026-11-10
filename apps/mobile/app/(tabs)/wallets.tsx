import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowRight } from "phosphor-react-native";
import { Colors } from "@/constants/colors";
import { FontFamily, FontSize } from "@/constants/typography";
import { useWalletStore } from "@/store/wallet";
import { formatNaira, maskBalance } from "@/lib/format";
import { CurrencyIcon } from "@/components/ui/CurrencyIcon";
import { Button } from "@/components/ui/Button";
import { useChainBalance, useLocalCryptoWallet } from "@/lib/crypto/hooks";
import { formatCoin } from "@/lib/crypto/networks";
import type { CryptoSymbol, LocalWallet } from "@/lib/crypto/keys";

const CRYPTO_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", color: Colors.crypto.btc },
  { symbol: "ETH", name: "Ethereum", color: Colors.crypto.eth },
  { symbol: "SOL", name: "Solana", color: Colors.crypto.sol },
  { symbol: "BNB", name: "BNB", color: Colors.crypto.bnb },
] satisfies { symbol: CryptoSymbol; name: string; color: string }[];

function CryptoCard({
  asset,
  userId,
  wallet,
  visible,
}: {
  asset: (typeof CRYPTO_ASSETS)[number];
  userId: string | undefined;
  wallet: LocalWallet | null | undefined;
  visible: boolean;
}) {
  const balance = useChainBalance(userId, wallet, asset.symbol);
  return (
    <TouchableOpacity
      style={styles.cryptoCard}
      onPress={() =>
        router.push({
          pathname: "/(modals)/crypto-wallet",
          params: { symbol: asset.symbol },
        })
      }
    >
      <View
        style={[styles.cryptoIcon, { backgroundColor: `${asset.color}20` }]}
      >
        <CurrencyIcon currency={asset.symbol} size={32} />
      </View>
      <Text style={styles.cryptoName}>{asset.name}</Text>
      <Text style={styles.cryptoSymbol}>{asset.symbol}</Text>
      <Text style={styles.cryptoBalance}>
        {!visible
          ? "••••"
          : balance.data !== undefined
            ? formatCoin(BigInt(balance.data), asset.symbol)
            : balance.isError
              ? "Unavailable"
              : "—"}{" "}
        {asset.symbol}
      </Text>
      <View style={styles.cryptoComingSoon}>
        <Text style={styles.cryptoComingSoonText}>
          {wallet ? "Open wallet" : "Create or import"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function WalletsScreen() {
  const { nairaWallet, balanceVisible } = useWalletStore();

  const { userId, wallet, query } = useLocalCryptoWallet();
  const walletsQuery = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => (await api.get("/wallets")).data.data,
  });
  const liveNairaWallet =
    walletsQuery.data?.find((item: any) => item.currency === "NGN") ??
    nairaWallet;
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Wallets</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.push("/(modals)/africa-transfer")}
          style={{ padding: 16, borderRadius: 16, backgroundColor: "#E1F5E7" }}
        >
          <Text style={{ color: "#005828", fontSize: 17 }}>
            African bank transfers →
          </Text>
        </TouchableOpacity>

        {/* Naira Wallet */}
        <TouchableOpacity onPress={() => router.push("/(tabs)/home")}>
          <LinearGradient
            colors={["#003D20", "#005828", "#00C853"]}
            style={styles.walletCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.walletCardTop}>
              <CurrencyIcon currency="NGN" />
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </View>
            <Text style={styles.walletCurrencyLabel}>Nigerian Naira</Text>
            <Text style={styles.walletBalance}>
              {balanceVisible
                ? liveNairaWallet
                  ? formatNaira(liveNairaWallet.balance)
                  : "—"
                : maskBalance(0, "NGN")}
            </Text>
            <View style={styles.walletCardBottom}>
              <Text style={styles.walletCurrencyCode}>NGN</Text>
              <ArrowRight size={18} color="rgba(255,255,255,0.6)" />
            </View>
            <View style={styles.decorCircle} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Dollar Wallet — coming soon */}
        <View style={styles.comingSoonCard}>
          <LinearGradient
            colors={["#0D1B2A", "#1A4A7A"]}
            style={styles.walletCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.walletCardTop}>
              <CurrencyIcon currency="USD" />
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonBadgeText}>Coming soon</Text>
              </View>
            </View>
            <Text style={styles.walletCurrencyLabel}>US Dollar</Text>
            <Text style={[styles.walletBalance, styles.walletBalanceDisabled]}>
              $0.00
            </Text>
            <View style={styles.walletCardBottom}>
              <Text style={styles.walletCurrencyCode}>USD</Text>
              <Text style={styles.comingSoonTag}>
                Virtual Card · FX · Remittance
              </Text>
            </View>
            <View
              style={[
                styles.decorCircle,
                { borderColor: "rgba(255,255,255,0.04)" },
              ]}
            />
          </LinearGradient>
        </View>

        {/* Crypto Wallet Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Crypto</Text>
          <View style={styles.comingSoonPill}>
            <Text style={styles.comingSoonPillText}>Send & receive</Text>
          </View>
        </View>

        {wallet ? (
          <Button
            title="Wallet recovery and security"
            variant="outline"
            onPress={() => router.push("/(modals)/wallet-security")}
          />
        ) : (
          <Button
            title="Create or import a multichain wallet"
            loading={query.isPending}
            disabled={query.isError}
            onPress={() => router.push("/(modals)/wallet-setup")}
          />
        )}
        {query.isError && (
          <Button
            title="Retry wallet lookup"
            variant="outline"
            onPress={() => void query.refetch()}
          />
        )}
        <View style={styles.cryptoGrid}>
          {CRYPTO_ASSETS.map((asset) => (
            <CryptoCard
              key={asset.symbol}
              asset={asset}
              userId={userId}
              wallet={wallet}
              visible={balanceVisible}
            />
          ))}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Your wallet, your keys</Text>
          <Text style={styles.infoText}>
            One recovery phrase secures your crypto wallet on this device. Send
            and receive on the selected network. Bank services use your account
            verification.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  title: {
    fontSize: FontSize.h2,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },

  walletCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    position: "relative",
    minHeight: 160,
  },
  walletCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  walletFlag: { fontSize: 28 },
  activeBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interMedium,
    color: Colors.white,
  },
  comingSoonBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  comingSoonBadgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interMedium,
    color: "rgba(255,255,255,0.5)",
  },
  walletCurrencyLabel: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  walletBalance: {
    fontSize: 28,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
    letterSpacing: -1,
    marginBottom: 16,
  },
  walletBalanceDisabled: { opacity: 0.4 },
  walletCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walletCurrencyCode: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.mono,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
  },
  comingSoonCard: { opacity: 0.85 },
  comingSoonTag: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interRegular,
    color: "rgba(255,255,255,0.4)",
  },
  decorCircle: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 30,
    borderColor: "rgba(255,255,255,0.05)",
    top: -40,
    right: -20,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  comingSoonPill: {
    backgroundColor: Colors.gray[100],
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  comingSoonPillText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[500],
  },

  cryptoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cryptoCard: {
    width: "47%",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  cryptoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cryptoSymbolText: {
    fontSize: 18,
    fontFamily: FontFamily.jakartaBold,
  },
  cryptoName: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  cryptoSymbol: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.mono,
    color: Colors.gray[400],
  },
  cryptoBalance: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.gray[700],
    marginTop: 4,
  },
  cryptoComingSoon: {
    marginTop: 6,
    backgroundColor: Colors.gray[100],
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  cryptoComingSoonText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[400],
  },

  infoBox: {
    backgroundColor: Colors.brand.pale,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  infoTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.brand.dark,
  },
  infoText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.brand.dark,
    lineHeight: 20,
    opacity: 0.8,
  },
});
