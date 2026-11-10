import { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { SettingsScreen, InfoCard } from "@/components/ui/SettingsScreen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Colors } from "@/constants/colors";
import { FontFamily } from "@/constants/typography";
import { getErrorMessage } from "@/lib/api";
import {
  useLocalCryptoWallet,
  useWalletPrivacy,
  walletQueryKey,
} from "@/lib/crypto/hooks";
import {
  changeWalletPassword,
  removeLocalWallet,
  unlockLocalWallet,
} from "@/lib/crypto/storage";

export default function WalletSecurityScreen() {
  const { userId, wallet } = useLocalCryptoWallet();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [phrase, setPhrase] = useState(""),
    [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false),
    [backedUp, setBackedUp] = useState(false),
    [removing, setRemoving] = useState(false);
  const clear = useCallback(() => {
    setPassword("");
    setNewPassword("");
    setConfirmation("");
    setPhrase("");
    setPassphrase("");
    setBackedUp(false);
    setRemoving(false);
  }, []);
  const guardOperation = useWalletPrivacy(clear);

  async function reveal() {
    if (!userId || !wallet || busy) return;
    const isActive = guardOperation();
    setBusy(true);
    try {
      const secrets = await unlockLocalWallet(userId, wallet, password);
      try {
        if (isActive()) {
          setPhrase(secrets.mnemonic);
          setPassphrase(secrets.passphrase);
        }
      } finally {
        secrets.mnemonic = "";
        secrets.passphrase = "";
      }
    } catch (error) {
      Toast.show({ type: "error", text1: getErrorMessage(error) });
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function changePassword() {
    if (!userId || !wallet || busy) return;
    setBusy(true);
    try {
      if (newPassword !== confirmation)
        throw new Error("The new wallet passwords do not match.");
      await changeWalletPassword(userId, wallet, password, newPassword);
      clear();
      Toast.show({ type: "success", text1: "Wallet password changed" });
    } catch (error) {
      Toast.show({ type: "error", text1: getErrorMessage(error) });
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function remove() {
    if (!userId || !wallet || !backedUp || busy) return;
    setBusy(true);
    try {
      await removeLocalWallet(userId, wallet, password);
      clear();
      queryClient.setQueryData(walletQueryKey(userId), null);
      router.replace("/(tabs)/wallets");
      Toast.show({ type: "success", text1: "Wallet removed from this device" });
    } catch (error) {
      Toast.show({ type: "error", text1: getErrorMessage(error) });
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <SettingsScreen title="Wallet recovery and security">
      {!wallet ? (
        <>
          <InfoCard title="Create or restore a wallet">
            Your recovery phrase restores access to your crypto independently of
            your Lightpay account.
          </InfoCard>
          <Button
            title="Create or import wallet"
            onPress={() => router.replace("/(modals)/wallet-setup")}
          />
        </>
      ) : (
        <>
          <InfoCard title="You control your wallet">
            Your recovery phrase unlocks your funds. Keep it private and store a
            backup. Lightpay cannot reset a lost wallet password or recover the
            phrase for you.
          </InfoCard>
          <Input
            label="Current wallet password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!busy}
          />
          <Button
            title="Show recovery phrase"
            disabled={!password}
            loading={busy}
            onPress={() => void reveal()}
          />
          {phrase && (
            <View style={styles.card}>
              <Text style={styles.title}>Recovery phrase · keep private</Text>
              <View style={styles.words}>
                {phrase.split(" ").map((word, index) => (
                  <Text key={index} style={styles.word}>
                    {index + 1}. {word}
                  </Text>
                ))}
              </View>
              {passphrase !== "" && (
                <>
                  <Text style={styles.title}>Recovery passphrase</Text>
                  <Text style={styles.word}>{passphrase}</Text>
                </>
              )}
              <Button
                title="Hide recovery phrase"
                variant="outline"
                onPress={() => {
                  setPhrase("");
                  setPassphrase("");
                }}
              />
            </View>
          )}
          <InfoCard title="Change wallet password">
            Use a new password with at least 12 characters. Your recovery phrase
            and blockchain addresses stay the same.
          </InfoCard>
          <Input
            label="New wallet password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!busy}
          />
          <Input
            label="Confirm new wallet password"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!busy}
          />
          <Button
            title="Change wallet password"
            variant="outline"
            disabled={!password || !newPassword || !confirmation}
            loading={busy}
            onPress={() => void changePassword()}
          />
          <InfoCard title="Remove from this device">
            Your funds stay on the blockchain. You will need the recovery phrase
            and any recovery passphrase to restore access.
          </InfoCard>
          <TouchableOpacity
            style={styles.checkbox}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: backedUp }}
            onPress={() => setBackedUp(!backedUp)}
            disabled={busy}
          >
            <Text style={styles.check}>{backedUp ? "✓" : "□"}</Text>
            <Text style={styles.body}>
              I saved my recovery phrase and any recovery passphrase.
            </Text>
          </TouchableOpacity>
          {removing ? (
            <>
              <Button
                title="Confirm removal from this device"
                variant="danger"
                disabled={!backedUp || !password}
                loading={busy}
                onPress={() => void remove()}
              />
              <Button
                title="Keep this wallet"
                variant="ghost"
                onPress={() => setRemoving(false)}
              />
            </>
          ) : (
            <Button
              title="Remove wallet from this device"
              variant="danger"
              disabled={!backedUp || busy}
              onPress={() => setRemoving(true)}
            />
          )}
        </>
      )}
    </SettingsScreen>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 16,
  },
  title: {
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
    fontSize: 16,
  },
  words: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  word: {
    width: "45%",
    fontFamily: FontFamily.mono,
    fontSize: 13,
    lineHeight: 22,
    color: Colors.gray[700],
  },
  checkbox: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { color: Colors.brand.dark, fontSize: 24 },
  body: { color: Colors.gray[700], flex: 1, lineHeight: 22 },
});
