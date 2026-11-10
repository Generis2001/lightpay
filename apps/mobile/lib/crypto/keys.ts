import { HDKey } from "@scure/bip32";
import {
  entropyToMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { p2wpkh } from "@scure/btc-signer";
import { base58 } from "@scure/base";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { ed25519 } from "@noble/curves/ed25519";
import { computeAddress } from "ethers";

export type CryptoSymbol = "BTC" | "ETH" | "SOL" | "BNB";
export const CRYPTO_SYMBOLS: CryptoSymbol[] = ["BTC", "ETH", "SOL", "BNB"];
export const DERIVATION_PATHS = {
  BTC: "m/84'/0'/0'/0/0",
  ETH: "m/44'/60'/0'/0/0",
  BNB: "m/44'/60'/0'/0/0",
  SOL: "m/44'/501'/0'/0'",
} as const;

export interface WalletSecrets {
  mnemonic: string;
  passphrase: string;
}
export interface BitcoinAddress {
  address: string;
  index: number;
  change: boolean;
}
export interface LocalWallet {
  version: 1;
  id: string;
  createdAt: string;
  addresses: Record<CryptoSymbol, string>;
  bitcoin: {
    accountXpub: string;
    addresses: BitcoinAddress[];
    needsDiscovery: boolean;
  };
}

export function normalizeMnemonic(value: string): string {
  return value.normalize("NFKD").trim().toLowerCase().split(/\s+/).join(" ");
}

export function checkMnemonic(value: string): string {
  const phrase = normalizeMnemonic(value);
  if (!validateMnemonic(phrase, wordlist)) {
    throw new Error(
      "Enter a valid English recovery phrase with 12, 15, 18, 21 or 24 words. Check the words and their order.",
    );
  }
  return phrase;
}

export function phraseFromEntropy(entropy: Uint8Array): string {
  if (entropy.length !== 32)
    throw new Error("Wallet creation requires 32 secure random bytes.");
  return entropyToMnemonic(entropy, wordlist);
}

function solanaKey(seed: Uint8Array): Uint8Array {
  let material = hmac(sha512, utf8ToBytes("ed25519 seed"), seed);
  try {
    for (const index of [44, 501, 0, 0]) {
      const data = new Uint8Array(37);
      data.set(material.subarray(0, 32), 1);
      new DataView(data.buffer).setUint32(33, index + 0x80000000, false);
      const next = hmac(sha512, material.subarray(32), data);
      material.fill(0);
      data.fill(0);
      material = next;
    }
    return material.slice(0, 32);
  } finally {
    material.fill(0);
  }
}

export function derivePrivateKey(
  secrets: WalletSecrets,
  symbol: CryptoSymbol,
  bitcoinAddress?: BitcoinAddress,
): Uint8Array {
  const seed = mnemonicToSeedSync(
    checkMnemonic(secrets.mnemonic),
    secrets.passphrase.normalize("NFKD"),
  );
  let root: HDKey | undefined;
  let child: HDKey | undefined;
  try {
    if (symbol === "SOL") return solanaKey(seed);
    root = HDKey.fromMasterSeed(seed);
    const path = bitcoinAddress
      ? `m/84'/0'/0'/${bitcoinAddress.change ? 1 : 0}/${bitcoinAddress.index}`
      : DERIVATION_PATHS[symbol];
    child = root.derive(path);
    if (!child.privateKey) throw new Error("Unable to derive wallet key.");
    return new Uint8Array(child.privateKey);
  } finally {
    seed.fill(0);
    root?.wipePrivateData();
    child?.wipePrivateData();
  }
}

export function bitcoinAddressAt(
  accountXpub: string,
  index: number,
  change: boolean,
): BitcoinAddress {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000)
    throw new Error("Invalid Bitcoin address index.");
  const key = HDKey.fromExtendedKey(accountXpub)
    .deriveChild(change ? 1 : 0)
    .deriveChild(index);
  if (!key.publicKey) throw new Error("Unable to derive Bitcoin address.");
  const address = p2wpkh(key.publicKey).address;
  if (!address) throw new Error("Unable to derive Bitcoin address.");
  return { address, index, change };
}

export function publicWallet(
  secrets: WalletSecrets,
  imported = false,
): LocalWallet {
  const seed = mnemonicToSeedSync(
    checkMnemonic(secrets.mnemonic),
    secrets.passphrase.normalize("NFKD"),
  );
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive("m/84'/0'/0'");
  const evm = root.derive(DERIVATION_PATHS.ETH);
  const sol = solanaKey(seed);
  try {
    if (!evm.privateKey) throw new Error("Unable to derive wallet.");
    const receive = bitcoinAddressAt(account.publicExtendedKey, 0, false);
    const change = bitcoinAddressAt(account.publicExtendedKey, 0, true);
    const ethereum = computeAddress(`0x${bytesToHex(evm.privateKey)}`);
    const addresses = {
      BTC: receive.address,
      ETH: ethereum,
      BNB: ethereum,
      SOL: base58.encode(ed25519.getPublicKey(sol)),
    };
    return {
      version: 1,
      id: bytesToHex(
        sha256(utf8ToBytes(Object.values(addresses).join(":"))),
      ).slice(0, 32),
      createdAt: new Date().toISOString(),
      addresses,
      bitcoin: {
        accountXpub: account.publicExtendedKey,
        addresses: [receive, change],
        needsDiscovery: imported,
      },
    };
  } finally {
    seed.fill(0);
    sol.fill(0);
    root.wipePrivateData();
    account.wipePrivateData();
    evm.wipePrivateData();
  }
}
