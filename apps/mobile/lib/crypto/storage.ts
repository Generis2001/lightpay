import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import {
  encryptWallet,
  decryptWallet,
  type EncryptedWallet,
} from "./encryption";
import {
  bitcoinAddressAt,
  publicWallet,
  type LocalWallet,
  type WalletSecrets,
} from "./keys";

const metadataKey = (userId: string) => `lightpay.crypto.public.${userId}`;
const vaultKey = (userId: string, id: string) =>
  `lightpay.crypto.vault.${userId}.${id}`;
const scanKey = (userId: string) => `lightpay.crypto.scan.${userId}`;
const secureOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const readVault = (key: string) =>
  Platform.OS === "web"
    ? AsyncStorage.getItem(key)
    : SecureStore.getItemAsync(key, secureOptions);
const writeVault = (key: string, value: string) =>
  Platform.OS === "web"
    ? AsyncStorage.setItem(key, value)
    : SecureStore.setItemAsync(key, value, secureOptions);
const writes = new Map<string, Promise<unknown>>();
async function exclusive<T>(
  userId: string,
  action: () => Promise<T>,
): Promise<T> {
  const operation = (writes.get(userId) ?? Promise.resolve())
    .catch(() => {})
    .then(action);
  writes.set(userId, operation);
  try {
    return await operation;
  } finally {
    if (writes.get(userId) === operation) writes.delete(userId);
  }
}
async function writePublic(userId: string, wallet: LocalWallet): Promise<void> {
  const base = {
    ...wallet,
    bitcoin: {
      ...wallet.bitcoin,
      addresses: [
        bitcoinAddressAt(wallet.bitcoin.accountXpub, 0, false),
        bitcoinAddressAt(wallet.bitcoin.accountXpub, 0, true),
      ],
    },
  };
  await AsyncStorage.setItem(
    scanKey(userId),
    JSON.stringify({ id: wallet.id, addresses: wallet.bitcoin.addresses }),
  );
  // Protect receiving addresses with the OS keystore as well as the encrypted key.
  // The larger, public Bitcoin scan cache stays outside the small keychain record.
  await writeVault(metadataKey(userId), JSON.stringify(base));
}

export async function readLocalWallet(
  userId: string,
): Promise<LocalWallet | null> {
  const stored = await readVault(metadataKey(userId));
  if (!stored) return null;
  const wallet = JSON.parse(stored) as LocalWallet;
  if (
    wallet.version !== 1 ||
    !/^[a-f0-9]{32}$/.test(wallet.id) ||
    !wallet.bitcoin?.accountXpub ||
    !wallet.addresses
  ) {
    throw new Error(
      "Wallet information is unavailable. Restore your recovery phrase.",
    );
  }
  const cache = await AsyncStorage.getItem(scanKey(userId));
  if (cache) {
    const value = JSON.parse(cache) as {
      id: string;
      addresses: LocalWallet["bitcoin"]["addresses"];
    };
    if (
      value.id === wallet.id &&
      Array.isArray(value.addresses) &&
      value.addresses.length <= 400 &&
      value.addresses.length >= 2
    ) {
      for (const address of value.addresses) {
        if (
          !Number.isSafeInteger(address.index) ||
          address.index < 0 ||
          address.index >= 200 ||
          typeof address.change !== "boolean" ||
          bitcoinAddressAt(
            wallet.bitcoin.accountXpub,
            address.index,
            address.change,
          ).address !== address.address
        )
          throw new Error("The Bitcoin address cache is invalid.");
      }
      wallet.bitcoin.addresses = value.addresses;
    } else wallet.bitcoin.needsDiscovery = true;
  } else wallet.bitcoin.needsDiscovery = true;
  return wallet;
}

export async function savePublicWallet(
  userId: string,
  wallet: LocalWallet,
): Promise<void> {
  return exclusive(userId, async () => {
    const existing = await readLocalWallet(userId);
    if (existing?.id !== wallet.id)
      throw new Error("The active wallet has changed.");
    await writePublic(userId, wallet);
  });
}

export async function createLocalWallet(
  userId: string,
  secrets: WalletSecrets,
  password: string,
  imported: boolean,
): Promise<LocalWallet> {
  return exclusive(userId, async () => {
    if (!userId) throw new Error("Sign in before creating a wallet.");
    if (await readLocalWallet(userId))
      throw new Error(
        "A wallet already exists on this device. Open wallet security to manage it.",
      );
    const wallet = publicWallet(secrets, imported);
    const encrypted = await encryptWallet(
      secrets,
      password,
      `${userId}:${wallet.id}`,
      await Crypto.getRandomBytesAsync(28),
    );
    await writeVault(vaultKey(userId, wallet.id), JSON.stringify(encrypted));
    await writePublic(userId, wallet);
    return wallet;
  });
}

export async function unlockLocalWallet(
  userId: string,
  wallet: LocalWallet,
  password: string,
): Promise<WalletSecrets> {
  const active = await readLocalWallet(userId);
  if (active?.id !== wallet.id)
    throw new Error("The active wallet has changed.");
  const stored = await readVault(vaultKey(userId, wallet.id));
  if (!stored)
    throw new Error(
      "This device no longer has the wallet key. Import your recovery phrase to restore it.",
    );
  const secrets = await decryptWallet(
    JSON.parse(stored) as EncryptedWallet,
    password,
    `${userId}:${wallet.id}`,
  );
  const derived = publicWallet(secrets);
  if (
    derived.id !== wallet.id ||
    Object.keys(wallet.addresses).some(
      (symbol) =>
        derived.addresses[symbol as keyof typeof derived.addresses] !==
        wallet.addresses[symbol as keyof typeof wallet.addresses],
    )
  ) {
    secrets.mnemonic = "";
    secrets.passphrase = "";
    throw new Error(
      "Wallet addresses do not match the encrypted key. Restore your recovery phrase.",
    );
  }
  return secrets;
}

export async function changeWalletPassword(
  userId: string,
  wallet: LocalWallet,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  return exclusive(userId, async () => {
    const secrets = await unlockLocalWallet(userId, wallet, oldPassword);
    try {
      const encrypted = await encryptWallet(
        secrets,
        newPassword,
        `${userId}:${wallet.id}`,
        await Crypto.getRandomBytesAsync(28),
      );
      await writeVault(vaultKey(userId, wallet.id), JSON.stringify(encrypted));
    } finally {
      secrets.mnemonic = "";
      secrets.passphrase = "";
    }
  });
}

export async function removeLocalWallet(
  userId: string,
  wallet: LocalWallet,
  password: string,
): Promise<void> {
  return exclusive(userId, async () => {
    const secrets = await unlockLocalWallet(userId, wallet, password);
    secrets.mnemonic = "";
    secrets.passphrase = "";
    const key = vaultKey(userId, wallet.id);
    if (Platform.OS === "web") await AsyncStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key, secureOptions);
    if (Platform.OS === "web")
      await AsyncStorage.removeItem(metadataKey(userId));
    else await SecureStore.deleteItemAsync(metadataKey(userId), secureOptions);
    await AsyncStorage.removeItem(scanKey(userId));
  });
}
