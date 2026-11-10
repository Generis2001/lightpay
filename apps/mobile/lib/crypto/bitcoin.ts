import { Transaction, Address, OutScript } from "@scure/btc-signer";
import { bytesToHex } from "@noble/hashes/utils";
import {
  bitcoinAddressAt,
  derivePrivateKey,
  type BitcoinAddress,
  type LocalWallet,
  type WalletSecrets,
} from "./keys";
import { bitcoinRequest, safeInteger } from "./networks";
import type { SignedTransfer, TransferQuote } from "./transfers";

interface BitcoinUtxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
  owner: BitcoinAddress;
}
export interface BitcoinTransferData {
  kind: "bitcoin";
  inputs: BitcoinUtxo[];
  change: string;
  changeAddress: string;
  feeRate: number;
  maxVsize: number;
}
const discovery = new Map<string, Promise<BitcoinAddress[]>>();

async function discover(wallet: LocalWallet): Promise<BitcoinAddress[]> {
  const found = [
    bitcoinAddressAt(wallet.bitcoin.accountXpub, 0, false),
    bitcoinAddressAt(wallet.bitcoin.accountXpub, 0, true),
  ];
  for (const change of [false, true]) {
    let gap = 0;
    for (let index = 0; index < 200; index += 4) {
      const batch = [0, 1, 2, 3].map((offset) =>
        bitcoinAddressAt(wallet.bitcoin.accountXpub, index + offset, change),
      );
      const states = await Promise.all(
        batch.map((address) =>
          bitcoinRequest<{
            chain_stats: { tx_count: number };
            mempool_stats: { tx_count: number };
          }>(`address/${address.address}`),
        ),
      );
      for (let position = 0; position < batch.length; position++) {
        const state = states[position];
        const used =
          safeInteger(state.chain_stats?.tx_count) +
            safeInteger(state.mempool_stats?.tx_count) >
          0;
        if (used) {
          found.push(batch[position]);
          gap = 0;
        } else gap++;
        if (gap >= 20) break;
      }
      if (gap >= 20) break;
      if (index === 196)
        throw new Error(
          "Bitcoin address discovery reached its account limit. Try a wallet supporting your full account history.",
        );
    }
  }
  return Array.from(
    new Map(found.map((address) => [address.address, address])).values(),
  );
}

export async function discoverBitcoin(wallet: LocalWallet): Promise<void> {
  let pending = discovery.get(wallet.id);
  if (!pending) {
    pending = discover(wallet);
    discovery.set(wallet.id, pending);
  }
  try {
    wallet.bitcoin.addresses = await pending;
    wallet.bitcoin.needsDiscovery = false;
  } finally {
    discovery.delete(wallet.id);
  }
}

async function availableUtxos(wallet: LocalWallet): Promise<BitcoinUtxo[]> {
  if (wallet.bitcoin.needsDiscovery) await discoverBitcoin(wallet);
  const lists = await Promise.all(
    wallet.bitcoin.addresses.map(async (owner) => {
      const expected = bitcoinAddressAt(
        wallet.bitcoin.accountXpub,
        owner.index,
        owner.change,
      );
      if (expected.address !== owner.address)
        throw new Error("The Bitcoin address does not match this wallet.");
      const list = await bitcoinRequest<Omit<BitcoinUtxo, "owner">[]>(
        `address/${owner.address}/utxo`,
      );
      if (!Array.isArray(list))
        throw new Error("Bitcoin balance information is unavailable.");
      return list
        .map((item) => {
          if (
            !/^[a-f0-9]{64}$/.test(item.txid) ||
            safeInteger(item.vout) > 0xffffffff ||
            safeInteger(item.value) > 2_100_000_000_000_000 ||
            typeof item.status?.confirmed !== "boolean"
          ) {
            throw new Error("Bitcoin returned invalid coin information.");
          }
          return { ...item, owner };
        })
        .filter((item) => item.status.confirmed && item.value > 0);
    }),
  );
  const coins = lists.flat(),
    unique = new Set(coins.map((coin) => `${coin.txid}:${coin.vout}`));
  if (unique.size !== coins.length)
    throw new Error("Bitcoin returned duplicate coins.");
  return coins;
}

export async function bitcoinBalance(wallet: LocalWallet): Promise<bigint> {
  return (await availableUtxos(wallet)).reduce(
    (sum, coin) => sum + BigInt(coin.value),
    0n,
  );
}

export async function prepareBitcoin(
  wallet: LocalWallet,
  to: string,
  amount: bigint,
): Promise<{ fee: string; data: BitcoinTransferData }> {
  if (amount < 546n)
    throw new Error("Bitcoin transfers must be at least 0.00000546 BTC.");
  const [coins, estimates] = await Promise.all([
    availableUtxos(wallet),
    bitcoinRequest<Record<string, number>>("fee-estimates"),
  ]);
  const rate = Math.ceil(estimates["6"] ?? estimates["3"]);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100_000)
    throw new Error("A valid Bitcoin network fee is unavailable.");
  const outputSize = 9 + OutScript.encode(Address().decode(to)).length;
  const inputs: BitcoinUtxo[] = [];
  let total = 0n,
    fee = 0n,
    change = 0n,
    maxVsize = 0;
  for (const coin of coins.sort((a, b) => b.value - a.value)) {
    if (inputs.length >= 120) break;
    inputs.push(coin);
    total += BigInt(coin.value);
    const noChangeSize = 12 + 69 * inputs.length + outputSize;
    const withChangeSize = noChangeSize + 31;
    const withChangeFee = BigInt(withChangeSize * rate);
    if (total >= amount + withChangeFee + 294n) {
      fee = withChangeFee;
      change = total - amount - fee;
      maxVsize = withChangeSize;
      break;
    }
    if (total >= amount + BigInt(noChangeSize * rate)) {
      fee = total - amount;
      change = 0n;
      maxVsize = noChangeSize;
      break;
    }
  }
  if (!maxVsize || total < amount + fee)
    throw new Error(
      "Insufficient confirmed Bitcoin balance for the amount and network fee.",
    );
  const changeAddress = bitcoinAddressAt(
    wallet.bitcoin.accountXpub,
    0,
    true,
  ).address;
  return {
    fee: fee.toString(),
    data: {
      kind: "bitcoin",
      inputs,
      change: change.toString(),
      changeAddress,
      feeRate: rate,
      maxVsize,
    },
  };
}

export async function signBitcoin(
  wallet: LocalWallet,
  quote: TransferQuote,
  secrets: WalletSecrets,
): Promise<SignedTransfer> {
  if (quote.data.kind !== "bitcoin")
    throw new Error("Invalid Bitcoin transfer.");
  const data = quote.data;
  if (!data.inputs.length || data.inputs.length > 120)
    throw new Error("Invalid Bitcoin input count.");
  const unique = new Set(
    data.inputs.map((input) => `${input.txid}:${input.vout}`),
  );
  if (unique.size !== data.inputs.length)
    throw new Error("Bitcoin inputs contain duplicate coins.");
  const tx = new Transaction();
  for (const input of data.inputs) {
    const expected = bitcoinAddressAt(
      wallet.bitcoin.accountXpub,
      input.owner.index,
      input.owner.change,
    );
    if (expected.address !== input.owner.address)
      throw new Error("This Bitcoin coin belongs to a different wallet.");
    const [parent, spent] = await Promise.all([
      bitcoinRequest<{ vout: { value: number; scriptpubkey: string }[] }>(
        `tx/${input.txid}`,
      ),
      bitcoinRequest<{ spent: boolean }>(
        `tx/${input.txid}/outspend/${input.vout}`,
      ),
    ]);
    const output = parent.vout?.[input.vout],
      script = OutScript.encode(Address().decode(input.owner.address));
    if (
      spent.spent !== false ||
      !output ||
      safeInteger(output.value) !== input.value ||
      output.scriptpubkey !== bytesToHex(script)
    ) {
      throw new Error(
        "A Bitcoin coin changed or does not belong to this wallet. Review a fresh transfer.",
      );
    }
    tx.addInput({
      txid: input.txid,
      index: input.vout,
      witnessUtxo: { script, amount: BigInt(input.value) },
    });
  }
  const total = data.inputs.reduce((sum, coin) => sum + BigInt(coin.value), 0n);
  const change = BigInt(data.change),
    fee = BigInt(quote.fee);
  if (
    fee <= 0n ||
    change < 0n ||
    (change > 0n && change < 294n) ||
    total !== BigInt(quote.units) + fee + change ||
    data.changeAddress !==
      bitcoinAddressAt(wallet.bitcoin.accountXpub, 0, true).address
  )
    throw new Error("The Bitcoin amounts or change address do not match.");
  tx.addOutputAddress(quote.to, BigInt(quote.units));
  if (change) tx.addOutputAddress(data.changeAddress, change);
  if (quote.expiresAt <= Date.now())
    throw new Error("This estimate expired. Review a fresh transfer.");
  for (const owner of new Map(
    data.inputs.map((input) => [input.owner.address, input.owner]),
  ).values()) {
    const key = derivePrivateKey(secrets, "BTC", owner);
    try {
      tx.sign(key);
    } finally {
      key.fill(0);
    }
  }
  tx.finalize();
  if (
    tx.fee !== fee ||
    tx.vsize > data.maxVsize ||
    fee < BigInt(tx.vsize * data.feeRate)
  )
    throw new Error("The signed Bitcoin fee exceeds the reviewed estimate.");
  return { hash: tx.id, raw: bytesToHex(tx.extract()) };
}
