import AsyncStorage from "@react-native-async-storage/async-storage";
import { readLocalWallet, unlockLocalWallet } from "./storage";
import { CRYPTO_SYMBOLS, type CryptoSymbol, type LocalWallet } from "./keys";
import {
  broadcastTransfer,
  signTransfer,
  transferStatus,
  validateSignedTransfer,
  type ChainStatus,
  type SignedTransfer,
  type TransferQuote,
} from "./transfers";

export interface LocalCryptoTransaction extends SignedTransfer {
  walletId: string;
  symbol: CryptoSymbol;
  from: string;
  to: string;
  amount: string;
  fee: string;
  feeIsMaximum: boolean;
  createdAt: string;
  status: ChainStatus;
}
const keyFor = (userId: string, walletId: string) =>
  `lightpay.crypto.transactions.${userId}.${walletId}`;
const locks = new Set<string>();
const writers = new Map<string, Promise<void>>();
const unresolved = (tx: LocalCryptoTransaction) =>
  tx.status === "pending" || tx.status === "unknown";

export async function readLocalTransactions(
  userId: string,
  walletId: string,
): Promise<LocalCryptoTransaction[]> {
  const stored = await AsyncStorage.getItem(keyFor(userId, walletId));
  if (!stored) return [];
  const entries = JSON.parse(stored) as LocalCryptoTransaction[];
  if (!Array.isArray(entries) || entries.length > 500)
    throw new Error(
      "Saved transfer history is unavailable. Check your transactions before sending again.",
    );
  for (const tx of entries) {
    if (
      !tx ||
      tx.walletId !== walletId ||
      !CRYPTO_SYMBOLS.includes(tx.symbol) ||
      !["unknown", "pending", "confirmed", "failed", "expired"].includes(
        tx.status,
      ) ||
      typeof tx.createdAt !== "string" ||
      !Number.isFinite(Date.parse(tx.createdAt)) ||
      typeof tx.fee !== "string" ||
      !/^\d+$/.test(tx.fee)
    )
      throw new Error(
        "Saved transfer history is damaged. Check your transactions before sending again.",
      );
    validateSignedTransfer(tx.symbol, tx, tx);
  }
  return entries;
}

async function saveTransaction(
  userId: string,
  tx: LocalCryptoTransaction,
): Promise<void> {
  const key = keyFor(userId, tx.walletId);
  const write = (writers.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const entries = await readLocalTransactions(userId, tx.walletId);
      const merged = [tx, ...entries.filter((entry) => entry.hash !== tx.hash)];
      const pending = merged.filter(unresolved),
        settled = merged.filter((entry) => !unresolved(entry)).slice(0, 100);
      await AsyncStorage.setItem(
        key,
        JSON.stringify(
          [...pending, ...settled].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
        ),
      );
    });
  writers.set(key, write);
  try {
    await write;
  } finally {
    if (writers.get(key) === write) writers.delete(key);
  }
}

export async function submitLocalTransfer(
  userId: string,
  wallet: LocalWallet,
  quote: TransferQuote,
  password: string,
  isActive: () => boolean,
): Promise<LocalCryptoTransaction> {
  const lock = `${userId}:${wallet.id}:${quote.symbol}`;
  if (locks.has(lock))
    throw new Error("This wallet is already submitting a transfer.");
  locks.add(lock);
  try {
    if (
      (await readLocalTransactions(userId, wallet.id)).some(
        (tx) => tx.symbol === quote.symbol && unresolved(tx),
      )
    ) {
      throw new Error(
        "Check the pending transfer before sending another on this network.",
      );
    }
    const secrets = await unlockLocalWallet(userId, wallet, password);
    let signed: SignedTransfer;
    try {
      if (!isActive())
        throw new Error("The wallet locked. Review your transfer again.");
      signed = await signTransfer(wallet, quote, secrets);
    } finally {
      secrets.mnemonic = "";
      secrets.passphrase = "";
    }
    if (!isActive() || (await readLocalWallet(userId))?.id !== wallet.id)
      throw new Error("The wallet locked. Review your transfer again.");
    const tx: LocalCryptoTransaction = {
      ...signed,
      walletId: wallet.id,
      symbol: quote.symbol,
      from: quote.from,
      to: quote.to,
      amount: quote.amount,
      fee: quote.fee,
      feeIsMaximum: quote.data.kind === "evm",
      createdAt: new Date().toISOString(),
      status: "unknown",
    };
    // Persist the exact signature before networking. A timeout can only retry these same bytes.
    await saveTransaction(userId, tx);
    if (isActive()) {
      try {
        await broadcastTransfer(quote.symbol, signed);
        tx.status = "pending";
      } catch {
        /* Keep the signed intent until its network outcome can be established. */
      }
      await saveTransaction(userId, tx);
    }
    return tx;
  } finally {
    locks.delete(lock);
  }
}

export async function refreshLocalTransactions(
  userId: string,
  walletId: string,
): Promise<LocalCryptoTransaction[]> {
  const entries = await readLocalTransactions(userId, walletId);
  for (const tx of entries.filter(unresolved).slice(0, 8)) {
    try {
      const status = await transferStatus(tx.symbol, tx);
      if (status !== "unknown" || tx.status !== "pending") tx.status = status;
      await saveTransaction(userId, tx);
    } catch {
      /* Connection failures do not imply success or failure on chain. */
    }
  }
  return readLocalTransactions(userId, walletId);
}

export async function retryLocalTransaction(
  userId: string,
  wallet: LocalWallet,
  hash: string,
  isActive: () => boolean,
): Promise<LocalCryptoTransaction> {
  const lock = `${userId}:${wallet.id}:retry`;
  if (locks.has(lock)) throw new Error("A submission is already in progress.");
  locks.add(lock);
  try {
    if (!isActive() || (await readLocalWallet(userId))?.id !== wallet.id)
      throw new Error("The wallet locked. Check your transfer again.");
    const tx = (await readLocalTransactions(userId, wallet.id)).find(
      (entry) => entry.hash === hash,
    );
    if (
      !tx ||
      tx.status !== "unknown" ||
      tx.from !== wallet.addresses[tx.symbol]
    )
      throw new Error("This transfer cannot be resubmitted. Check its status.");
    const status = await transferStatus(tx.symbol, tx);
    if (["confirmed", "failed", "expired"].includes(status)) {
      tx.status = status;
      await saveTransaction(userId, tx);
      return tx;
    }
    if (!isActive())
      throw new Error("The wallet locked. Check your transfer again.");
    try {
      await broadcastTransfer(tx.symbol, tx);
      tx.status = "pending";
    } catch {
      /* Retain the same transaction hash and signature. */
    }
    await saveTransaction(userId, tx);
    return tx;
  } finally {
    locks.delete(lock);
  }
}
