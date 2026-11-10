import { gcm } from "@noble/ciphers/aes";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { checkMnemonic, type WalletSecrets } from "./keys";
import { Buffer } from "buffer";

export const WALLET_KDF_ITERATIONS = 600_000;
export const MAX_WALLET_VAULT_BYTES = 2048;
export interface EncryptedWallet {
  version: 1;
  kdf: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export function checkWalletPassword(password: string): void {
  if (password.length < 12 || password.length > 256 || !password.trim()) {
    throw new Error(
      "Use a wallet password with at least 12 characters. A few unrelated words work well.",
    );
  }
}

async function encryptionKey(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const bytes = utf8ToBytes(password.normalize("NFKD"));
  try {
    return await pbkdf2Async(sha256, bytes, salt, {
      c: WALLET_KDF_ITERATIONS,
      dkLen: 32,
      asyncTick: 10,
    });
  } finally {
    bytes.fill(0);
  }
}

export async function encryptWallet(
  secrets: WalletSecrets,
  password: string,
  binding: string,
  random: Uint8Array,
): Promise<EncryptedWallet> {
  checkWalletPassword(password);
  if (random.length !== 28)
    throw new Error("Secure encryption randomness is unavailable.");
  const salt = random.slice(0, 16),
    iv = random.slice(16);
  const plaintext = utf8ToBytes(
    JSON.stringify({
      mnemonic: checkMnemonic(secrets.mnemonic),
      passphrase: secrets.passphrase,
    }),
  );
  let key: Uint8Array | undefined;
  try {
    key = await encryptionKey(password, salt);
    const vault: EncryptedWallet = {
      version: 1,
      kdf: "pbkdf2-sha256",
      iterations: WALLET_KDF_ITERATIONS,
      salt: bytesToHex(salt),
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(
        gcm(key, iv, utf8ToBytes(binding)).encrypt(plaintext),
      ),
    };
    // SecureStore documents a 2 KB value limit. All serialized fields are ASCII.
    if (JSON.stringify(vault).length > MAX_WALLET_VAULT_BYTES) {
      throw new Error(
        "This recovery passphrase is too long for Lightpay. Restore it in a wallet that supports longer passphrases.",
      );
    }
    return vault;
  } finally {
    key?.fill(0);
    plaintext.fill(0);
    random.fill(0);
  }
}

export async function decryptWallet(
  vault: EncryptedWallet,
  password: string,
  binding: string,
): Promise<WalletSecrets> {
  if (
    vault.version !== 1 ||
    vault.kdf !== "pbkdf2-sha256" ||
    vault.iterations !== WALLET_KDF_ITERATIONS ||
    !/^[a-f0-9]{32}$/.test(vault.salt) ||
    !/^[a-f0-9]{24}$/.test(vault.iv) ||
    !/^[a-f0-9]{32,4096}$/.test(vault.ciphertext) ||
    vault.ciphertext.length % 2
  ) {
    throw new Error(
      "This wallet backup is damaged or unsupported. Restore it with your recovery phrase.",
    );
  }
  const key = await encryptionKey(password, hexToBytes(vault.salt));
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = gcm(key, hexToBytes(vault.iv), utf8ToBytes(binding)).decrypt(
      hexToBytes(vault.ciphertext),
    );
    const value = JSON.parse(
      Buffer.from(plaintext).toString("utf8"),
    ) as WalletSecrets;
    if (typeof value.passphrase !== "string")
      throw new Error("Invalid wallet.");
    return {
      mnemonic: checkMnemonic(value.mnemonic),
      passphrase: value.passphrase,
    };
  } catch {
    throw new Error("Incorrect wallet password or damaged wallet.");
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}
