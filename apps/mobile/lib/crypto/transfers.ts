import {
  Wallet as EthereumWallet,
  Transaction as EvmTransaction,
  keccak256,
} from "ethers";
import { Transaction as BitcoinTransaction } from "@scure/btc-signer";
import {
  Transaction as SolanaTransaction,
  SystemInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { base58 } from "@scure/base";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type { CryptoSymbol, LocalWallet, WalletSecrets } from "./keys";
import { derivePrivateKey } from "./keys";
import {
  ensureMainnet,
  hexInteger,
  safeInteger,
  rpc,
  parseCoin,
  recipientAddress,
  NETWORKS,
} from "./networks";
import {
  bitcoinBalance,
  prepareBitcoin,
  signBitcoin,
  type BitcoinTransferData,
} from "./bitcoin";
import {
  solanaBalance,
  prepareSolana,
  signSolana,
  type SolanaTransferData,
} from "./solana";

export interface TransferQuote {
  walletId: string;
  symbol: CryptoSymbol;
  from: string;
  to: string;
  amount: string;
  units: string;
  fee: string;
  expiresAt: number;
  data:
    | { kind: "evm"; nonce: number; gasLimit: string; gasPrice: string }
    | BitcoinTransferData
    | SolanaTransferData;
}
export interface SignedTransfer {
  hash: string;
  raw: string;
  lastValidBlockHeight?: number;
}
export type ChainStatus =
  "unknown" | "pending" | "confirmed" | "failed" | "expired";

export async function readChainBalance(
  wallet: LocalWallet,
  symbol: CryptoSymbol,
): Promise<bigint> {
  await ensureMainnet(symbol);
  if (symbol === "BTC") return bitcoinBalance(wallet);
  if (symbol === "SOL") return solanaBalance(wallet.addresses.SOL);
  return hexInteger(
    await rpc<string>(symbol, "eth_getBalance", [
      wallet.addresses[symbol],
      "latest",
    ]),
  );
}

export async function prepareTransfer(
  wallet: LocalWallet,
  symbol: CryptoSymbol,
  recipient: string,
  amount: string,
): Promise<TransferQuote> {
  await ensureMainnet(symbol);
  const to = recipientAddress(recipient, symbol),
    units = parseCoin(amount, symbol);
  const base = {
    walletId: wallet.id,
    symbol,
    from: wallet.addresses[symbol],
    to,
    amount: amount.trim(),
    units: units.toString(),
    expiresAt: Date.now() + 60_000,
  };
  if (symbol === "BTC")
    return { ...base, ...(await prepareBitcoin(wallet, to, units)) };
  if (symbol === "SOL")
    return {
      ...base,
      ...(await prepareSolana(wallet.addresses.SOL, to, units)),
    };
  const [balance, nonce, estimate, price] = await Promise.all([
    rpc<string>(symbol, "eth_getBalance", [base.from, "pending"]),
    rpc<string>(symbol, "eth_getTransactionCount", [base.from, "pending"]),
    rpc<string>(symbol, "eth_estimateGas", [
      { from: base.from, to, value: `0x${units.toString(16)}` },
    ]),
    rpc<string>(symbol, "eth_gasPrice", []),
  ]);
  const gasLimit = (hexInteger(estimate) * 120n + 99n) / 100n,
    gasPrice = hexInteger(price);
  if (!gasLimit || !gasPrice)
    throw new Error("The network fee is unavailable.");
  const fee = gasLimit * gasPrice,
    transactionNonce = Number(hexInteger(nonce));
  safeInteger(transactionNonce);
  if (hexInteger(balance) < units + fee)
    throw new Error("Insufficient balance for the amount and network fee.");
  return {
    ...base,
    fee: fee.toString(),
    data: {
      kind: "evm",
      nonce: transactionNonce,
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrice.toString(),
    },
  };
}

export async function signTransfer(
  wallet: LocalWallet,
  quote: TransferQuote,
  secrets: WalletSecrets,
): Promise<SignedTransfer> {
  if (
    quote.walletId !== wallet.id ||
    quote.from !== wallet.addresses[quote.symbol]
  )
    throw new Error("This transfer belongs to a different wallet.");
  if (quote.expiresAt <= Date.now())
    throw new Error("This estimate expired. Review a fresh transfer.");
  if (
    parseCoin(quote.amount, quote.symbol).toString() !== quote.units ||
    recipientAddress(quote.to, quote.symbol) !== quote.to
  )
    throw new Error("The transfer details changed. Review again.");
  await ensureMainnet(quote.symbol);
  if (quote.data.kind === "bitcoin" && quote.symbol === "BTC")
    return signBitcoin(wallet, quote, secrets);
  if (quote.data.kind === "solana" && quote.symbol === "SOL")
    return signSolana(quote, secrets);
  if (
    quote.data.kind !== "evm" ||
    (quote.symbol !== "ETH" && quote.symbol !== "BNB")
  )
    throw new Error("The transfer network does not match.");
  const [nonce, balance] = await Promise.all([
    rpc<string>(quote.symbol, "eth_getTransactionCount", [
      quote.from,
      "pending",
    ]),
    rpc<string>(quote.symbol, "eth_getBalance", [quote.from, "pending"]),
  ]);
  if (hexInteger(nonce) !== BigInt(quote.data.nonce))
    throw new Error(
      "Another transaction changed the wallet. Review a fresh transfer.",
    );
  const maxFee = BigInt(quote.data.gasLimit) * BigInt(quote.data.gasPrice);
  if (
    maxFee.toString() !== quote.fee ||
    hexInteger(balance) < BigInt(quote.units) + maxFee
  )
    throw new Error("The balance or network fee changed. Review again.");
  if (quote.expiresAt <= Date.now())
    throw new Error("This estimate expired. Review a fresh transfer.");
  const key = derivePrivateKey(secrets, quote.symbol);
  try {
    const signer = new EthereumWallet(`0x${bytesToHex(key)}`);
    if (signer.address !== quote.from)
      throw new Error("The signing key does not match this wallet.");
    const raw = await signer.signTransaction({
      chainId: NETWORKS[quote.symbol].chainId,
      type: 0,
      nonce: quote.data.nonce,
      to: quote.to,
      value: BigInt(quote.units),
      gasLimit: BigInt(quote.data.gasLimit),
      gasPrice: BigInt(quote.data.gasPrice),
    });
    return { raw, hash: keccak256(raw) };
  } finally {
    key.fill(0);
  }
}

export function validateSignedTransfer(
  symbol: CryptoSymbol,
  signed: SignedTransfer,
  details?: Pick<TransferQuote, "from" | "to" | "amount">,
): void {
  try {
    if (
      typeof signed.raw !== "string" ||
      !signed.raw.length ||
      signed.raw.length > 100_000
    )
      throw new Error();
    const units = details ? parseCoin(details.amount, symbol) : undefined;
    if (symbol === "BTC") {
      const tx = BitcoinTransaction.fromRaw(hexToBytes(signed.raw));
      if (
        tx.id !== signed.hash ||
        (details &&
          (tx.getOutputAddress(0) !== details.to ||
            tx.getOutput(0).amount !== units))
      )
        throw new Error();
    } else if (symbol === "SOL") {
      const tx = SolanaTransaction.from(Buffer.from(signed.raw, "base64"));
      if (
        !tx.signature ||
        !tx.verifySignatures() ||
        base58.encode(tx.signature) !== signed.hash
      )
        throw new Error();
      if (details) {
        if (tx.instructions.length !== 1) throw new Error();
        const transfer = SystemInstruction.decodeTransfer(tx.instructions[0]);
        if (
          tx.feePayer?.toBase58() !== details.from ||
          transfer.fromPubkey.toBase58() !== details.from ||
          transfer.toPubkey.toBase58() !== details.to ||
          BigInt(transfer.lamports) !== units
        )
          throw new Error();
      }
    } else {
      const tx = EvmTransaction.from(signed.raw);
      if (
        !tx.signature ||
        tx.hash !== signed.hash ||
        tx.chainId !== BigInt(NETWORKS[symbol].chainId) ||
        (details &&
          (tx.from !== details.from ||
            tx.to !== details.to ||
            tx.value !== units))
      )
        throw new Error();
    }
  } catch {
    throw new Error(
      "The saved signed transaction is damaged or does not match its details. Check its status before sending again.",
    );
  }
}

export async function broadcastTransfer(
  symbol: CryptoSymbol,
  signed: SignedTransfer,
): Promise<void> {
  validateSignedTransfer(symbol, signed);
  await ensureMainnet(symbol);
  let returned: string;
  if (symbol === "BTC") {
    const { networkFetch } = await import("./networks");
    const response = await networkFetch(
      `${NETWORKS.BTC.url.replace(/\/$/, "")}/tx`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: signed.raw,
      },
    );
    if (!response.ok) throw new Error("Submission could not be confirmed.");
    returned = (await response.text()).trim();
  } else if (symbol === "SOL") {
    returned = await rpc<string>("SOL", "sendTransaction", [
      signed.raw,
      {
        encoding: "base64",
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      },
    ]);
  } else
    returned = await rpc<string>(symbol, "eth_sendRawTransaction", [
      signed.raw,
    ]);
  if (returned !== signed.hash)
    throw new Error(
      "Submission could not be confirmed. Check the transaction before sending again.",
    );
}

export async function transferStatus(
  symbol: CryptoSymbol,
  signed: SignedTransfer,
): Promise<ChainStatus> {
  await ensureMainnet(symbol);
  if (symbol === "BTC") {
    const { networkFetch } = await import("./networks");
    const response = await networkFetch(
      `${NETWORKS.BTC.url.replace(/\/$/, "")}/tx/${encodeURIComponent(signed.hash)}/status`,
    );
    if (response.status === 404) return "unknown";
    if (!response.ok) throw new Error("Unable to check Bitcoin confirmation.");
    const result = (await response.json()) as { confirmed?: boolean };
    if (typeof result.confirmed !== "boolean")
      throw new Error("Bitcoin confirmation is unavailable.");
    return result.confirmed ? "confirmed" : "pending";
  }
  if (symbol === "SOL") {
    const result = await rpc<{
      value: ({ err: unknown; confirmationStatus: string } | null)[];
    }>("SOL", "getSignatureStatuses", [
      [signed.hash],
      { searchTransactionHistory: true },
    ]);
    if (!Array.isArray(result.value) || result.value.length !== 1)
      throw new Error("Solana confirmation is unavailable.");
    const status = result.value[0];
    if (status?.err) return "failed";
    if (status)
      return ["confirmed", "finalized"].includes(status.confirmationStatus)
        ? "confirmed"
        : "pending";
    if (
      signed.lastValidBlockHeight !== undefined &&
      safeInteger(
        await rpc<number>("SOL", "getBlockHeight", [
          { commitment: "confirmed" },
        ]),
      ) > signed.lastValidBlockHeight
    )
      return "expired";
    return "unknown";
  }
  const receipt = await rpc<{ transactionHash: string; status: string } | null>(
    symbol,
    "eth_getTransactionReceipt",
    [signed.hash],
  );
  if (!receipt) return "unknown";
  if (
    receipt.transactionHash !== signed.hash ||
    !["0x0", "0x1"].includes(receipt.status)
  )
    throw new Error("The transaction receipt does not match.");
  return receipt.status === "0x1" ? "confirmed" : "failed";
}
