import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { base58 } from "@scure/base";
import { ed25519 } from "@noble/curves/ed25519";
import { derivePrivateKey, type WalletSecrets } from "./keys";
import { formatCoin, rpc, safeInteger } from "./networks";
import type { SignedTransfer, TransferQuote } from "./transfers";

export interface SolanaTransferData {
  kind: "solana";
  blockhash: string;
  lastValidBlockHeight: number;
}

function transaction(
  from: string,
  to: string,
  amount: bigint,
  data: SolanaTransferData,
): Transaction {
  return new Transaction({
    feePayer: new PublicKey(from),
    recentBlockhash: data.blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(from),
      toPubkey: new PublicKey(to),
      lamports: amount,
    }),
  );
}

export async function solanaBalance(address: string): Promise<bigint> {
  const result = await rpc<{ value: number }>("SOL", "getBalance", [
    address,
    { commitment: "confirmed" },
  ]);
  return BigInt(safeInteger(result.value));
}

async function messageFee(tx: Transaction): Promise<bigint> {
  const result = await rpc<{ value: number | null }>(
    "SOL",
    "getFeeForMessage",
    [
      Buffer.from(tx.serializeMessage()).toString("base64"),
      { commitment: "confirmed" },
    ],
  );
  if (result.value === null)
    throw new Error("The Solana blockhash expired. Review a fresh transfer.");
  const fee = safeInteger(result.value);
  if (!fee) throw new Error("The Solana network fee is unavailable.");
  return BigInt(fee);
}

export async function prepareSolana(
  from: string,
  to: string,
  amount: bigint,
): Promise<{ fee: string; data: SolanaTransferData }> {
  const [latest, balance, recipient] = await Promise.all([
    rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
      "SOL",
      "getLatestBlockhash",
      [{ commitment: "confirmed" }],
    ),
    solanaBalance(from),
    rpc<{ value: unknown }>("SOL", "getAccountInfo", [
      to,
      { encoding: "base64", commitment: "confirmed" },
    ]),
  ]);
  const data: SolanaTransferData = {
    kind: "solana",
    blockhash: new PublicKey(latest.value.blockhash).toBase58(),
    lastValidBlockHeight: safeInteger(latest.value.lastValidBlockHeight),
  };
  if (!Object.hasOwn(recipient, "value"))
    throw new Error("Recipient information is unavailable.");
  if (recipient.value === null) {
    const rent = BigInt(
      safeInteger(
        await rpc<number>("SOL", "getMinimumBalanceForRentExemption", [0]),
      ),
    );
    if (amount < rent)
      throw new Error(
        `Send at least ${formatCoin(rent, "SOL")} SOL to activate a new recipient account.`,
      );
  }
  const fee = await messageFee(transaction(from, to, amount, data));
  if (balance < amount + fee)
    throw new Error("Insufficient SOL for the amount and network fee.");
  return { fee: fee.toString(), data };
}

export async function signSolana(
  quote: TransferQuote,
  secrets: WalletSecrets,
): Promise<SignedTransfer> {
  if (quote.data.kind !== "solana") throw new Error("Invalid Solana transfer.");
  const tx = transaction(quote.from, quote.to, BigInt(quote.units), quote.data);
  const [height, balance, fee] = await Promise.all([
    rpc<number>("SOL", "getBlockHeight", [{ commitment: "confirmed" }]),
    solanaBalance(quote.from),
    messageFee(tx),
  ]);
  if (
    safeInteger(height) > quote.data.lastValidBlockHeight ||
    quote.expiresAt <= Date.now()
  )
    throw new Error("This estimate expired. Review a fresh transfer.");
  if (fee.toString() !== quote.fee || balance < BigInt(quote.units) + fee)
    throw new Error("The balance or network fee changed. Review again.");
  const key = derivePrivateKey(secrets, "SOL"),
    secretKey = new Uint8Array(64);
  try {
    const publicKey = ed25519.getPublicKey(key);
    if (base58.encode(publicKey) !== quote.from)
      throw new Error("The signing key does not match this wallet.");
    secretKey.set(key);
    secretKey.set(publicKey, 32);
    tx.sign({ publicKey: new PublicKey(quote.from), secretKey });
    if (!tx.signature) throw new Error("Solana did not produce a signature.");
    return {
      hash: base58.encode(tx.signature),
      raw: Buffer.from(tx.serialize()).toString("base64"),
      lastValidBlockHeight: quote.data.lastValidBlockHeight,
    };
  } finally {
    key.fill(0);
    secretKey.fill(0);
  }
}
