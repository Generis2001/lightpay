import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import Toast from "react-native-toast-message";
import { SettingsScreen, InfoCard } from "@/components/ui/SettingsScreen";
import { LightpayLogo } from "@/components/ui/LightpayLogo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Colors } from "@/constants/colors";
import { FontFamily } from "@/constants/typography";
import { getErrorMessage } from "@/lib/api";
import {
  checkMnemonic,
  normalizeMnemonic,
  phraseFromEntropy,
} from "@/lib/crypto/keys";
import { createLocalWallet } from "@/lib/crypto/storage";
import {
  useLocalCryptoWallet,
  useWalletPrivacy,
  walletQueryKey,
} from "@/lib/crypto/hooks";

export default function WalletSetupScreen() {
  const { symbol = "BTC" } = useLocalSearchParams<{ symbol: string }>();
  const { userId, wallet } = useLocalCryptoWallet();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"choose" | "create" | "import">("choose");
  const [phrase, setPhrase] = useState(""),
    [passphrase, setPassphrase] = useState("");
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [indices, setIndices] = useState([2, 10, 18]),
    [answers, setAnswers] = useState(["", "", ""]);
  const [backedUp, setBackedUp] = useState(false),
    [busy, setBusy] = useState(false);
  const clear = useCallback(() => {
    setPhrase("");
    setPassphrase("");
    setPassword("");
    setConfirmation("");
    setAnswers(["", "", ""]);
    setBackedUp(false);
    setMode("choose");
  }, []);
  const guardOperation = useWalletPrivacy(clear);

  async function generate() {
    if (busy) return;
    const isActive = guardOperation();
    setBusy(true);
    try {
      const entropy = await Crypto.getRandomBytesAsync(32);
      if (!isActive()) {
        entropy.fill(0);
        return;
      }
      try {
        setPhrase(phraseFromEntropy(entropy));
        setIndices([
          entropy[0] % 8,
          8 + (entropy[1] % 8),
          16 + (entropy[2] % 8),
        ]);
      } finally {
        entropy.fill(0);
      }
      setMode("create");
    } catch (error) {
      Toast.show({ type: "error", text1: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!userId || busy) return;
    const isActive = guardOperation();
    setBusy(true);
    try {
      const mnemonic = checkMnemonic(phrase);
      if (password !== confirmation)
        throw new Error("The wallet passwords do not match.");
      if (
        mode === "create" &&
        (!backedUp ||
          indices.some(
            (index, position) =>
              normalizeMnemonic(answers[position]) !==
              mnemonic.split(" ")[index],
          ))
      )
        throw new Error(
          "Save the recovery phrase and confirm the three requested words.",
        );
      const imported = mode === "import";
      const created = await createLocalWallet(
        userId,
        { mnemonic, passphrase },
        password,
        imported,
      );
      clear();
      queryClient.setQueryData(walletQueryKey(userId), created);
      if (!isActive()) return;
      router.replace({
        pathname: "/(modals)/crypto-wallet",
        params: { symbol },
      });
      Toast.show({
        type: "success",
        text1: imported ? "Wallet imported" : "Wallet created",
      });
    } catch (error) {
      Toast.show({ type: "error", text1: getErrorMessage(error) });
    } finally {
      setBusy(false);
      setPassword("");
      setConfirmation("");
    }
  }
  return (
    <SettingsScreen title="Create or import wallet">
      <LightpayLogo size={56} />
      {wallet ? (
        <>
          <InfoCard title="Your wallet is ready">
            Open your wallet to receive, send, or manage its recovery phrase.
          </InfoCard>
          <Button
            title="Open wallet"
            onPress={() =>
              router.replace({
                pathname: "/(modals)/crypto-wallet",
                params: { symbol },
              })
            }
          />
        </>
      ) : (
        <>
          {mode === "choose" ? (
            <>
              <InfoCard title="One wallet, four networks">
                Create a wallet for Bitcoin, Ethereum, Solana and BNB Smart
                Chain, or restore an existing recovery phrase. Your keys are
                encrypted on this device.
              </InfoCard>
              <Button
                title="Create a new wallet"
                loading={busy}
                onPress={() => void generate()}
              />
              <Button
                title="Import an existing wallet"
                variant="outline"
                disabled={busy}
                onPress={() => setMode("import")}
              />
            </>
          ) : (
            <>
              {mode === "create" ? (
                <>
                  <InfoCard title="Save your recovery phrase">
                    Write these 24 words in order and keep them private. They
                    restore your wallet if you lose this device or its password.
                  </InfoCard>
                  <View style={styles.words}>
                    {phrase.split(" ").map((word, index) => (
                      <View key={index} style={styles.word}>
                        <Text style={styles.number}>{index + 1}</Text>
                        <Text style={styles.wordText}>{word}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: backedUp }}
                    onPress={() => setBackedUp(!backedUp)}
                    style={styles.checkbox}
                    disabled={busy}
                  >
                    <Text style={styles.check}>{backedUp ? "✓" : "□"}</Text>
                    <Text style={styles.body}>
                      I saved my recovery phrase somewhere private.
                    </Text>
                  </TouchableOpacity>
                  {indices.map((index, position) => (
                    <Input
                      key={index}
                      label={`Confirm word ${index + 1}`}
                      value={answers[position]}
                      onChangeText={(value) =>
                        setAnswers((current) =>
                          current.map((answer, p) =>
                            p === position ? value : answer,
                          ),
                        )
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                    />
                  ))}
                </>
              ) : (
                <>
                  <InfoCard title="Restore your wallet">
                    Import an English BIP39 recovery phrase. Lightpay uses the
                    first standard Ethereum/BNB and Solana accounts and Bitcoin
                    SegWit account 0.
                  </InfoCard>
                  <Input
                    label="Recovery phrase"
                    value={phrase}
                    onChangeText={setPhrase}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="none"
                    autoComplete="off"
                    editable={!busy}
                  />
                  <Input
                    label="Recovery passphrase (optional)"
                    hint="Only fill this if your existing wallet uses a BIP39 passphrase."
                    value={passphrase}
                    onChangeText={setPassphrase}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    editable={!busy}
                  />
                </>
              )}
              <Input
                label="New wallet password"
                hint="At least 12 characters. Use this password to unlock and sign."
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                editable={!busy}
              />
              <Input
                label="Confirm wallet password"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                editable={!busy}
              />
              <Button
                title={
                  mode === "create"
                    ? "Confirm backup and create wallet"
                    : "Import wallet"
                }
                loading={busy}
                onPress={() => void save()}
              />
              <Button
                title="Back"
                variant="ghost"
                disabled={busy}
                onPress={clear}
              />
            </>
          )}
        </>
      )}
    </SettingsScreen>
  );
}
const styles = StyleSheet.create({
  words: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: {
    width: "30%",
    flexDirection: "row",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.white,
  },
  number: { color: Colors.gray[400], fontSize: 11 },
  wordText: {
    color: Colors.ink.DEFAULT,
    fontFamily: FontFamily.mono,
    fontSize: 12,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  check: { color: Colors.brand.dark, fontSize: 24 },
  body: {
    color: Colors.gray[700],
    flex: 1,
    fontFamily: FontFamily.interRegular,
    lineHeight: 22,
  },
});
