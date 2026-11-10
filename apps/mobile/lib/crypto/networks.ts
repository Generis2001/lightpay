import { formatUnits, getAddress, parseUnits } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { Address } from "@scure/btc-signer";
import type { CryptoSymbol } from "./keys";

export const NETWORKS = {
  BTC: {
    name: "Bitcoin",
    decimals: 8,
    url:
      process.env.EXPO_PUBLIC_BITCOIN_API_URL ?? "https://blockstream.info/api",
    explorer: "https://blockstream.info",
    genesis: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
  },
  ETH: {
    name: "Ethereum",
    decimals: 18,
    url:
      process.env.EXPO_PUBLIC_ETHEREUM_RPC_URL ??
      "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
    chainId: 1,
  },
  SOL: {
    name: "Solana",
    decimals: 9,
    url:
      process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
      "https://solana-rpc.publicnode.com",
    explorer: "https://solscan.io",
    genesis: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  },
  BNB: {
    name: "BNB Smart Chain",
    decimals: 18,
    url:
      process.env.EXPO_PUBLIC_BNB_RPC_URL ?? "https://bsc-rpc.publicnode.com",
    explorer: "https://bscscan.com",
    chainId: 56,
  },
} as const;

export function parseCoin(amount: string, symbol: CryptoSymbol): bigint {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount.trim()))
    throw new Error("Enter an amount without commas or scientific notation.");
  let units: bigint;
  try {
    units = parseUnits(amount.trim(), NETWORKS[symbol].decimals);
  } catch {
    throw new Error(
      `Use at most ${NETWORKS[symbol].decimals} decimal places for ${symbol}.`,
    );
  }
  if (units <= 0n) throw new Error("Enter an amount greater than zero.");
  return units;
}
export const formatCoin = (units: bigint, symbol: CryptoSymbol) =>
  formatUnits(units, NETWORKS[symbol].decimals).replace(/\.0$/, "");

export function recipientAddress(value: string, symbol: CryptoSymbol): string {
  try {
    const address = value.trim();
    if (symbol === "ETH" || symbol === "BNB") return getAddress(address);
    if (symbol === "SOL") return new PublicKey(address).toBase58();
    Address().decode(address);
    return address;
  } catch {
    throw new Error(
      `Enter a valid recipient address on ${NETWORKS[symbol].name}.`,
    );
  }
}

export async function networkFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  if (new URL(url).protocol !== "https:")
    throw new Error("Blockchain connections require HTTPS.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    throw new Error(
      "The blockchain connection is unavailable. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function rpc<T>(
  symbol: Exclude<CryptoSymbol, "BTC">,
  method: string,
  params: unknown[],
): Promise<T> {
  const response = await networkFetch(NETWORKS[symbol].url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok)
    throw new Error(
      "The blockchain service rejected the request. Try again shortly.",
    );
  const body = (await response.json()) as { result?: T; error?: unknown };
  if (body.error || !Object.hasOwn(body, "result"))
    throw new Error("The blockchain request failed. Refresh and try again.");
  return body.result as T;
}

export async function bitcoinRequest<T>(path: string): Promise<T> {
  const response = await networkFetch(
    `${NETWORKS.BTC.url.replace(/\/$/, "")}/${path}`,
  );
  if (!response.ok)
    throw new Error("The Bitcoin service is unavailable. Try again shortly.");
  return (await response.json()) as T;
}

export function hexInteger(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value))
    throw new Error("The blockchain returned an invalid amount.");
  return BigInt(value);
}
export function safeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("The blockchain returned an invalid amount.");
  return value;
}

export async function ensureMainnet(symbol: CryptoSymbol): Promise<void> {
  if (symbol === "BTC") {
    const response = await networkFetch(
      `${NETWORKS.BTC.url.replace(/\/$/, "")}/block-height/0`,
    );
    if (!response.ok || (await response.text()).trim() !== NETWORKS.BTC.genesis)
      throw new Error("This connection is not Bitcoin mainnet.");
  } else if (symbol === "SOL") {
    if (
      (await rpc<string>("SOL", "getGenesisHash", [])) !== NETWORKS.SOL.genesis
    )
      throw new Error("This connection is not Solana mainnet.");
  } else {
    if (
      hexInteger(await rpc<string>(symbol, "eth_chainId", [])) !==
      BigInt(NETWORKS[symbol].chainId)
    )
      throw new Error(`This connection is not ${NETWORKS[symbol].name}.`);
  }
}

export function transactionUrl(symbol: CryptoSymbol, hash: string): string {
  return `${NETWORKS[symbol].explorer}/tx/${encodeURIComponent(hash)}`;
}
