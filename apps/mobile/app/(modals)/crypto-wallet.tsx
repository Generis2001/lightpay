import { useCallback, useState } from "react";
import { View, Text, Share, Linking, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { SettingsScreen, InfoCard } from "@/components/ui/SettingsScreen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CurrencyIcon } from "@/components/ui/CurrencyIcon";
import { getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Colors } from "@/constants/colors";
import { FontFamily } from "@/constants/typography";
import { CRYPTO_SYMBOLS, type CryptoSymbol } from "@/lib/crypto/keys";
import { formatCoin, NETWORKS, transactionUrl } from "@/lib/crypto/networks";
import { prepareTransfer, type TransferQuote } from "@/lib/crypto/transfers";
import {
  retryLocalTransaction,
  submitLocalTransfer,
} from "@/lib/crypto/journal";
import {
  useChainBalance,
  useCryptoTransactions,
  useLocalCryptoWallet,
  useWalletPrivacy,
} from "@/lib/crypto/hooks";
import { discoverBitcoin } from "@/lib/crypto/bitcoin";
import { savePublicWallet } from "@/lib/crypto/storage";

export default function CryptoWalletScreen() {
  const { symbol: requestedSymbol } = useLocalSearchParams<{
    symbol: string;
  }>();
  const symbol: CryptoSymbol = CRYPTO_SYMBOLS.includes(
    requestedSymbol as CryptoSymbol,
  )
    ? (requestedSymbol as CryptoSymbol)
    : "BTC";
  const { userId, wallet, query } = useLocalCryptoWallet();
  const balance = useChainBalance(userId, wallet, symbol),
    transactions = useCryptoTransactions(userId, wallet);
  const queryClient = useQueryClient();
  const [address, setAddress] = useState(""),
    [amount, setAmount] = useState(""),
    [password, setPassword] = useState("");
  const [quote, setQuote] = useState<TransferQuote>();
  const clear = useCallback(() => {
    setPassword("");
    setQuote(undefined);
  }, []);
  const guardOperation = useWalletPrivacy(clear);
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["chain-balance", userId, wallet?.id],
    });
    void queryClient.invalidateQueries({
      queryKey: ["local-crypto-transactions", userId, wallet?.id],
    });
  };
  const estimate = useMutation({
    mutationFn: async () => {
      const isActive = guardOperation();
      const result = await prepareTransfer(wallet!, symbol, address, amount);
      if (!isActive())
        throw new Error("The wallet locked. Review your transfer again.");
      return result;
    },
    onSuccess: (data) => {
      setQuote(data);
      setPassword("");
    },
    onError: (error) =>
      Toast.show({ type: "error", text1: getErrorMessage(error) }),
  });
  const send = useMutation({
    mutationFn: () => {
      const isActive = guardOperation();
      return submitLocalTransfer(
        userId!,
        wallet!,
        quote!,
        password,
        () => useAuthStore.getState().user?.id === userId && isActive(),
      );
    },
    onSuccess: (tx) => {
      clear();
      setAmount("");
      refresh();
      Toast.show({
        type: tx.status === "pending" ? "success" : "info",
        text1:
          tx.status === "pending"
            ? "Transfer submitted"
            : "Check submission status",
        text2: "Confirmation is shown in your wallet history.",
      });
    },
    onError: (error) =>
      Toast.show({ type: "error", text1: getErrorMessage(error) }),
    onSettled: () => setPassword(""),
  });
  const retry = useMutation({
    mutationFn: (hash: string) => {
      const isActive = guardOperation();
      return retryLocalTransaction(
        userId!,
        wallet!,
        hash,
        () => useAuthStore.getState().user?.id === userId && isActive(),
      );
    },
    onSettled: refresh,
    onError: (error) =>
      Toast.show({ type: "error", text1: getErrorMessage(error) }),
  });
  const discover = useMutation({
    mutationFn: async () => {
      await discoverBitcoin(wallet!);
      await savePublicWallet(userId!, wallet!);
    },
    onSuccess: refresh,
    onError: (error) =>
      Toast.show({ type: "error", text1: getErrorMessage(error) }),
  });
  const entries = transactions.data?.filter((tx) => tx.symbol === symbol) ?? [];
  const pending = entries.some(
    (tx) => tx.status === "unknown" || tx.status === "pending",
  );

  return (
    <SettingsScreen title={`${symbol} wallet`}>
      <CurrencyIcon currency={symbol} size={48} />
      <InfoCard title={NETWORKS[symbol].name}>
        {wallet
          ? balance.data !== undefined
            ? `${formatCoin(BigInt(balance.data), symbol)} ${symbol} confirmed on chain`
            : balance.isError
              ? "Balance could not be loaded. Refresh to try again."
              : "Reading your balance from the blockchain…"
          : "Create or import a wallet to receive and send crypto."}
      </InfoCard>
      {query.isError && (
        <Button
          title="Retry wallet lookup"
          onPress={() => void query.refetch()}
        />
      )}
      {!wallet ? (
        <Button
          title="Create or import wallet"
          disabled={query.isPending || query.isError}
          onPress={() =>
            router.push({
              pathname: "/(modals)/wallet-setup",
              params: { symbol },
            })
          }
        />
      ) : (
        <>
          <Button
            title="Refresh balance and status"
            variant="outline"
            loading={balance.isFetching || transactions.isFetching}
            onPress={refresh}
          />
          <View style={styles.receive}>
            <QRCode value={wallet.addresses[symbol]} size={180} />
            <Text selectable style={styles.address}>
              {wallet.addresses[symbol]}
            </Text>
            <Text style={styles.body}>
              Receive {symbol} on {NETWORKS[symbol].name}.
            </Text>
            <Button
              title="Copy address"
              onPress={() => {
                void Clipboard.setStringAsync(wallet.addresses[symbol]);
                Toast.show({ type: "success", text1: "Address copied" });
              }}
            />
            <Button
              title="Share address"
              variant="outline"
              onPress={() =>
                void Share.share({
                  message: `${symbol} on ${NETWORKS[symbol].name}\n${wallet.addresses[symbol]}`,
                })
              }
            />
          </View>
          {symbol === "BTC" && (
            <Button
              title="Find restored Bitcoin addresses"
              variant="ghost"
              loading={discover.isPending}
              onPress={() => discover.mutate()}
            />
          )}
          {transactions.isError ? (
            <InfoCard title="Transfer history unavailable">
              Your saved transfers could not be checked. Refresh before sending
              another transfer.
            </InfoCard>
          ) : pending ? (
            <InfoCard title="A transfer is awaiting confirmation">
              Check the transfer below before sending another on this network.
              If submission was interrupted, retry sends the exact same signed
              transaction.
            </InfoCard>
          ) : (
            <>
              <Input
                label={`Recipient on ${NETWORKS[symbol].name}`}
                value={address}
                onChangeText={(value) => {
                  setAddress(value);
                  clear();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!send.isPending && !estimate.isPending}
              />
              <Input
                label={`Amount the recipient receives (${symbol})`}
                value={amount}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setAmount(value);
                  clear();
                }}
                editable={!send.isPending && !estimate.isPending}
              />
              <Button
                title="Review transfer"
                disabled={!address || !amount || send.isPending}
                loading={estimate.isPending}
                onPress={() => estimate.mutate()}
              />
              {quote && (
                <>
                  <InfoCard title="Review before signing">{`Recipient: ${quote.to}\nReceives: ${quote.amount} ${symbol}\n${quote.data.kind === "evm" ? "Maximum" : "Network"} fee: ${formatCoin(BigInt(quote.fee), symbol)} ${symbol}\nMaximum wallet debit: ${formatCoin(BigInt(quote.units) + BigInt(quote.fee), symbol)} ${symbol}\nThis estimate expires after one minute.`}</InfoCard>
                  <Input
                    label="Wallet password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    editable={!send.isPending}
                  />
                  <Button
                    title="Sign and send"
                    loading={send.isPending}
                    disabled={!password}
                    onPress={() => send.mutate()}
                  />
                </>
              )}
            </>
          )}
          {entries.length > 0 && (
            <Text style={styles.title}>Wallet transfers</Text>
          )}
          {entries.slice(0, 10).map((tx) => (
            <View key={tx.hash} style={styles.transaction}>
              <Text style={styles.title}>
                {tx.amount} {symbol} ·{" "}
                {tx.status === "unknown" ? "Submission unconfirmed" : tx.status}
              </Text>
              <Text selectable style={styles.address}>
                {tx.hash}
              </Text>
              <Text style={styles.body}>
                {tx.feeIsMaximum ? "Fee cap" : "Network fee"}:{" "}
                {formatCoin(BigInt(tx.fee), symbol)} {symbol}
              </Text>
              <Button
                title="View on explorer"
                variant="outline"
                onPress={() =>
                  void Linking.openURL(transactionUrl(symbol, tx.hash))
                }
              />
              {tx.status === "unknown" && (
                <Button
                  title="Retry this submission"
                  loading={retry.isPending}
                  onPress={() => retry.mutate(tx.hash)}
                />
              )}
            </View>
          ))}
          <Button
            title="Wallet recovery and security"
            variant="ghost"
            onPress={() => router.push("/(modals)/wallet-security")}
          />
        </>
      )}
    </SettingsScreen>
  );
}
const styles = StyleSheet.create({
  receive: {
    padding: 20,
    alignItems: "center",
    gap: 16,
    borderRadius: 16,
    backgroundColor: Colors.white,
  },
  address: {
    color: Colors.gray[700],
    fontFamily: FontFamily.mono,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
  body: {
    color: Colors.gray[500],
    fontFamily: FontFamily.interRegular,
    lineHeight: 22,
  },
  title: {
    color: Colors.ink.DEFAULT,
    fontFamily: FontFamily.jakartaSemiBold,
    fontSize: 16,
  },
  transaction: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    backgroundColor: Colors.white,
  },
});
