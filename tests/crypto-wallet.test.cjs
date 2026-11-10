const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
require("ts-node").register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: "commonjs",
    target: "es2022",
    esModuleInterop: true,
  },
});
const { Transaction: EvmTransaction, keccak256 } = require("ethers");
const {
  Transaction: BitcoinTransaction,
  Address,
  OutScript,
} = require("@scure/btc-signer");
const {
  Transaction: SolanaTransaction,
  SystemInstruction,
} = require("@solana/web3.js");
const { base58 } = require("@scure/base");
const { bytesToHex, hexToBytes } = require("@noble/hashes/utils");
const {
  publicWallet,
  derivePrivateKey,
  checkMnemonic,
  phraseFromEntropy,
  bitcoinAddressAt,
} = require("../apps/mobile/lib/crypto/keys.ts");
const {
  encryptWallet,
  decryptWallet,
  WALLET_KDF_ITERATIONS,
  MAX_WALLET_VAULT_BYTES,
} = require("../apps/mobile/lib/crypto/encryption.ts");
const {
  NETWORKS,
  parseCoin,
  formatCoin,
  recipientAddress,
} = require("../apps/mobile/lib/crypto/networks.ts");
const {
  prepareTransfer,
  signTransfer,
  readChainBalance,
  broadcastTransfer,
} = require("../apps/mobile/lib/crypto/transfers.ts");
const {
  createWalletPrivacyGuard,
} = require("../apps/mobile/lib/crypto/privacy.ts");

// Published BIP39 test material. Never use these words for a funded wallet.
const PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const SECRETS = { mnemonic: PHRASE, passphrase: "" };
const PASSWORD = "isolated wallet test password";
const wallet = publicWallet(SECRETS);
const recipient = publicWallet({ mnemonic: PHRASE, passphrase: "TREZOR" });

const local = new Map(),
  secure = new Map();
const memory = (map) => ({
  getItem: async (key) => map.get(key) ?? null,
  setItem: async (key, value) => {
    map.set(key, value);
  },
  removeItem: async (key) => {
    map.delete(key);
  },
});
const Module = require("node:module"),
  originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@react-native-async-storage/async-storage")
    return memory(local);
  if (name === "react-native") return { Platform: { OS: "android" } };
  if (name === "expo-crypto")
    return {
      getRandomBytesAsync: async (size) => new Uint8Array(randomBytes(size)),
    };
  if (name === "expo-secure-store")
    return {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
      getItemAsync: async (key) => secure.get(key) ?? null,
      setItemAsync: async (key, value) => {
        secure.set(key, value);
      },
      deleteItemAsync: async (key) => {
        secure.delete(key);
      },
    };
  return originalLoad.call(this, name, parent, isMain);
};
const storage = require("../apps/mobile/lib/crypto/storage.ts");
const journal = require("../apps/mobile/lib/crypto/journal.ts");
Module._load = originalLoad;

function response(value, status = 200) {
  return new Response(
    typeof value === "string" ? value : JSON.stringify(value),
    { status },
  );
}
async function fixture(run, settings = {}) {
  const originalFetch = global.fetch;
  const calls = [],
    raw = [];
  const state = { rejectBroadcast: false, receipt: null, ...settings };
  const script = bytesToHex(
    OutScript.encode(Address().decode(wallet.addresses.BTC)),
  );
  global.fetch = async (target, options = {}) => {
    const url = new URL(target),
      headers = new Headers(options.headers);
    assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("api-key"), null);
    calls.push({ url: target, body: options.body });
    if (url.host === "blockstream.info") {
      if (url.pathname.endsWith("/block-height/0"))
        return response(NETWORKS.BTC.genesis);
      if (url.pathname.endsWith("/fee-estimates")) return response({ 6: 1.5 });
      if (/\/address\/[^/]+$/.test(url.pathname))
        return response({
          chain_stats: {
            tx_count:
              state.bitcoinAllUsed ||
              state.bitcoinHistory?.includes(url.pathname.split("/").at(-1))
                ? 1
                : 0,
          },
          mempool_stats: { tx_count: 0 },
        });
      if (url.pathname.endsWith("/utxo"))
        return response(
          url.pathname.includes(
            state.bitcoinFundedAddress ?? wallet.addresses.BTC,
          )
            ? [
                {
                  txid: "11".repeat(32),
                  vout: 0,
                  value: 100000,
                  status: { confirmed: true },
                },
                {
                  txid: "22".repeat(32),
                  vout: 0,
                  value: 500000,
                  status: { confirmed: false },
                },
              ]
            : [],
        );
      if (url.pathname.includes("/outspend/"))
        return response({ spent: !!state.spent });
      if (url.pathname.endsWith("/tx/" + "11".repeat(32)))
        return response({
          vout: [{ value: state.parentValue ?? 100000, scriptpubkey: script }],
        });
      if (url.pathname.endsWith("/tx") && options.method === "POST") {
        raw.push(options.body);
        if (state.rejectBroadcast)
          throw new Error("isolated connection failure");
        return response(
          BitcoinTransaction.fromRaw(hexToBytes(options.body)).id,
        );
      }
      throw new Error("Unrecognized isolated Bitcoin request: " + url.pathname);
    }
    const request = JSON.parse(options.body),
      params = request.params;
    let result;
    switch (request.method) {
      case "eth_chainId":
        result =
          state.chainOverride ?? (url.host.includes("bsc") ? "0x38" : "0x1");
        break;
      case "eth_getBalance":
        result = state.evmBalance ?? "0x4563918244f40000";
        break;
      case "eth_getTransactionCount":
        result = "0x0";
        break;
      case "eth_estimateGas":
        result = "0x5208";
        break;
      case "eth_gasPrice":
        result = "0x3b9aca00";
        break;
      case "eth_getTransactionReceipt":
        result = state.receipt;
        break;
      case "eth_sendRawTransaction":
        raw.push(params[0]);
        if (state.rejectBroadcast)
          throw new Error("isolated connection failure");
        result = state.badAcknowledgement
          ? "0x" + "00".repeat(32)
          : keccak256(params[0]);
        break;
      case "getGenesisHash":
        result =
          state.genesisOverride ??
          "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
        break;
      case "getBalance":
        result = { value: 2000000000 };
        break;
      case "getLatestBlockhash":
        result = {
          value: {
            blockhash: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
            lastValidBlockHeight: 200,
          },
        };
        break;
      case "getBlockHeight":
        result = 100;
        break;
      case "getAccountInfo":
        result = { value: state.newSolanaRecipient ? null : {} };
        break;
      case "getMinimumBalanceForRentExemption":
        result = 890880;
        break;
      case "getFeeForMessage":
        result = { value: 5000 };
        break;
      case "getSignatureStatuses":
        result = { value: [null] };
        break;
      case "sendTransaction": {
        raw.push(params[0]);
        const tx = SolanaTransaction.from(Buffer.from(params[0], "base64"));
        assert.ok(tx.verifySignatures());
        result = base58.encode(tx.signature);
        break;
      }
      default:
        throw new Error("Unrecognized isolated RPC method: " + request.method);
    }
    return response({ jsonrpc: "2.0", id: 1, result });
  };
  try {
    await run({ state, calls, raw });
  } finally {
    global.fetch = originalFetch;
  }
}

test("wallet derivation runs without native TextEncoder or Buffer globals and preserves Unicode bytes", () => {
  const encoder = global.TextEncoder,
    buffer = global.Buffer;
  try {
    global.TextEncoder = undefined;
    global.Buffer = undefined;
    require("../apps/mobile/lib/polyfills.js");
    assert.equal(
      global.Buffer.from("wallet 😊").toString("hex"),
      "77616c6c657420f09f988a",
    );
    assert.deepEqual(
      Array.from(new global.TextEncoder().encode("wallet 😊")),
      [119, 97, 108, 108, 101, 116, 32, 240, 159, 152, 138],
    );
    assert.equal(
      publicWallet(SECRETS).addresses.ETH,
      "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
    );
  } finally {
    global.TextEncoder = encoder;
    global.Buffer = buffer;
  }
});

test("returning to the foreground cannot revive an unlock or transfer started before the wallet locked", () => {
  const privacy = createWalletPrivacyGuard();
  assert.equal(privacy.begin()(), false);
  privacy.activate();
  const original = privacy.begin();
  assert.equal(original(), true);
  privacy.lock();
  privacy.activate();
  assert.equal(original(), false);
  const resumed = privacy.begin();
  assert.equal(resumed(), true);
  privacy.lock();
  assert.equal(resumed(), false);
});

test("standard recovery phrases restore independently verified BTC, ETH, BNB and Solana addresses", () => {
  assert.equal(
    wallet.addresses.BTC,
    "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
  );
  assert.equal(
    wallet.addresses.ETH,
    "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  );
  assert.equal(wallet.addresses.BNB, wallet.addresses.ETH);
  // Independently derived with Node/OpenSSL SLIP-0010 + Ed25519, not the app's crypto libraries.
  assert.equal(
    wallet.addresses.SOL,
    "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
  );
  assert.equal(checkMnemonic(PHRASE.toUpperCase()), PHRASE);
  assert.equal(phraseFromEntropy(new Uint8Array(32)).split(" ").length, 24);
  assert.throws(() => checkMnemonic("abandon ".repeat(12)), /valid English/);
  assert.ok(!JSON.stringify(wallet).includes(PHRASE));
  assert.ok(!JSON.stringify(wallet).includes("xprv"));
  assert.notEqual(
    publicWallet({ mnemonic: PHRASE, passphrase: "TREZOR" }).id,
    wallet.id,
  );
});

test("encrypted recovery data rejects a wrong password, another owner and authenticated-ciphertext tampering", async () => {
  const value = { mnemonic: PHRASE, passphrase: "unicode recovery 😊" };
  const vault = await encryptWallet(
    value,
    PASSWORD,
    "owner:wallet",
    new Uint8Array(randomBytes(28)),
  );
  assert.equal(vault.iterations, WALLET_KDF_ITERATIONS);
  assert.ok(Buffer.byteLength(JSON.stringify(vault)) <= MAX_WALLET_VAULT_BYTES);
  assert.ok(!JSON.stringify(vault).includes(PHRASE));
  assert.deepEqual(await decryptWallet(vault, PASSWORD, "owner:wallet"), value);
  await assert.rejects(
    decryptWallet(vault, "incorrect wallet password", "owner:wallet"),
    /Incorrect/,
  );
  await assert.rejects(
    decryptWallet(vault, PASSWORD, "different-owner:wallet"),
    /Incorrect/,
  );
  const modified = {
    ...vault,
    ciphertext:
      (vault.ciphertext[0] === "0" ? "1" : "0") + vault.ciphertext.slice(1),
  };
  await assert.rejects(
    decryptWallet(modified, PASSWORD, "owner:wallet"),
    /Incorrect/,
  );
  await assert.rejects(
    encryptWallet(value, "123456", "owner:wallet", new Uint8Array(28)),
    /12 characters/,
  );
  for (const passphrase of ["x".repeat(1024), "😊".repeat(300)]) {
    const random = new Uint8Array(randomBytes(28));
    await assert.rejects(
      encryptWallet(
        { mnemonic: PHRASE, passphrase },
        PASSWORD,
        "owner:wallet",
        random,
      ),
      /recovery passphrase is too long/,
    );
    assert.ok(random.every((byte) => byte === 0));
  }
});

test("amounts preserve all chain decimals and reject wrong networks and unsupported precision", async () => {
  assert.equal(parseCoin("0.000000000000000001", "ETH"), 1n);
  assert.equal(formatCoin(123456789123456789n, "ETH"), "0.123456789123456789");
  assert.throws(() => parseCoin("0.000000001", "BTC"), /8 decimal/);
  assert.throws(() => parseCoin("1e3", "SOL"), /scientific/);
  assert.throws(
    () => recipientAddress(wallet.addresses.BTC.replace(/^bc1/, "tb1"), "BTC"),
    /valid recipient/,
  );
  await fixture(
    async () => {
      await assert.rejects(readChainBalance(wallet, "ETH"), /not Ethereum/);
    },
    { chainOverride: "0x38" },
  );
  await fixture(
    async () => {
      await assert.rejects(readChainBalance(wallet, "ETH"), /invalid amount/);
    },
    { evmBalance: 1 },
  );
  await fixture(
    async () => {
      await assert.rejects(
        readChainBalance(wallet, "SOL"),
        /not Solana mainnet/,
      );
    },
    { genesisOverride: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" },
  );
});

test("EVM signatures retain the reviewed recipient, exact amount, chain ID and fee cap", async () => {
  await fixture(async () => {
    for (const symbol of ["ETH", "BNB"]) {
      const quote = await prepareTransfer(
        wallet,
        symbol,
        recipient.addresses[symbol],
        "0.000000000000000001",
      );
      const signed = await signTransfer(wallet, quote, SECRETS),
        decoded = EvmTransaction.from(signed.raw);
      assert.equal(decoded.from, wallet.addresses[symbol]);
      assert.equal(decoded.to, recipient.addresses[symbol]);
      assert.equal(decoded.value, 1n);
      assert.equal(decoded.chainId, BigInt(NETWORKS[symbol].chainId));
      assert.equal(decoded.gasLimit * decoded.gasPrice, BigInt(quote.fee));
      assert.equal(decoded.hash, signed.hash);
      await broadcastTransfer(symbol, signed);
      await assert.rejects(
        signTransfer(wallet, { ...quote, expiresAt: Date.now() - 1 }, SECRETS),
        /expired/,
      );
    }
  });
});

test("Bitcoin signs only owned, confirmed coins and returns change without exceeding the reviewed fee", async () => {
  await fixture(async () => {
    assert.equal(await readChainBalance(wallet, "BTC"), 100000n);
    const quote = await prepareTransfer(
      wallet,
      "BTC",
      recipient.addresses.BTC,
      "0.0005",
    );
    const signed = await signTransfer(wallet, quote, SECRETS),
      decoded = BitcoinTransaction.fromRaw(hexToBytes(signed.raw));
    assert.equal(decoded.getOutputAddress(0), recipient.addresses.BTC);
    assert.equal(decoded.getOutput(0).amount, 50000n);
    assert.equal(
      decoded.getOutputAddress(1),
      bitcoinAddressAt(wallet.bitcoin.accountXpub, 0, true).address,
    );
    assert.equal(decoded.id, signed.hash);
    assert.ok(BigInt(quote.fee) >= BigInt(decoded.vsize * quote.data.feeRate));
    await broadcastTransfer("BTC", signed);
  });
  await fixture(
    async () => {
      const quote = await prepareTransfer(
        wallet,
        "BTC",
        recipient.addresses.BTC,
        "0.0005",
      );
      await assert.rejects(
        signTransfer(wallet, quote, SECRETS),
        /coin changed/,
      );
    },
    { parentValue: 99999 },
  );
});

test("Bitcoin restoration discovers later receiving and change addresses and fails rather than hiding history beyond its limit", async () => {
  const restored = publicWallet(SECRETS, true);
  const receive = bitcoinAddressAt(restored.bitcoin.accountXpub, 5, false);
  const change = bitcoinAddressAt(restored.bitcoin.accountXpub, 3, true);
  await fixture(
    async ({ calls }) => {
      assert.equal(await readChainBalance(restored, "BTC"), 100000n);
      assert.equal(restored.bitcoin.needsDiscovery, false);
      assert.ok(
        restored.bitcoin.addresses.some(
          (value) => value.address === receive.address,
        ),
      );
      assert.ok(
        restored.bitcoin.addresses.some(
          (value) => value.address === change.address,
        ),
      );
      const scanned = calls.filter((call) =>
        /\/address\/[^/]+$/.test(new URL(call.url).pathname),
      );
      assert.ok(scanned.length > 40 && scanned.length < 60);
    },
    {
      bitcoinHistory: [receive.address, change.address],
      bitcoinFundedAddress: receive.address,
    },
  );
  const extended = publicWallet(SECRETS, true);
  await fixture(
    async () => {
      await assert.rejects(readChainBalance(extended, "BTC"), /account limit/);
      assert.equal(extended.bitcoin.needsDiscovery, true);
    },
    { bitcoinAllUsed: true },
  );
});

test("Solana signatures and transfer instructions retain the exact recipient and lamports", async () => {
  await fixture(async () => {
    const quote = await prepareTransfer(
      wallet,
      "SOL",
      recipient.addresses.SOL,
      "0.000000001",
    );
    const signed = await signTransfer(wallet, quote, SECRETS),
      decoded = SolanaTransaction.from(Buffer.from(signed.raw, "base64"));
    assert.ok(decoded.verifySignatures());
    assert.equal(base58.encode(decoded.signature), signed.hash);
    const instruction = SystemInstruction.decodeTransfer(
      decoded.instructions[0],
    );
    assert.equal(instruction.toPubkey.toBase58(), recipient.addresses.SOL);
    assert.equal(BigInt(instruction.lamports), 1n);
    assert.equal(quote.fee, "5000");
    await broadcastTransfer("SOL", signed);
  });
  await fixture(
    async () => {
      await assert.rejects(
        prepareTransfer(wallet, "SOL", recipient.addresses.SOL, "0.000000001"),
        /activate/,
      );
    },
    { newSolanaRecipient: true },
  );
});

test("a mismatched broadcast acknowledgement cannot be treated as a successful submission", async () => {
  await fixture(
    async () => {
      const quote = await prepareTransfer(
        wallet,
        "ETH",
        recipient.addresses.ETH,
        "0.01",
      );
      const signed = await signTransfer(wallet, quote, SECRETS);
      await assert.rejects(
        broadcastTransfer("ETH", signed),
        /could not be confirmed/,
      );
    },
    { badAcknowledgement: true },
  );
});

test("native storage protects the recovery phrase and receiving metadata, and concurrent creation cannot overwrite a wallet", async () => {
  local.clear();
  secure.clear();
  await assert.rejects(
    storage.createLocalWallet(
      "storage-owner",
      { mnemonic: PHRASE, passphrase: "😊".repeat(300) },
      PASSWORD,
      true,
    ),
    /recovery passphrase is too long/,
  );
  assert.equal(local.size, 0);
  assert.equal(secure.size, 0);
  assert.equal(await storage.readLocalWallet("storage-owner"), null);
  const results = await Promise.allSettled([
    storage.createLocalWallet("storage-owner", SECRETS, PASSWORD, false),
    storage.createLocalWallet("storage-owner", SECRETS, PASSWORD, false),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.match(
    results.find((result) => result.status === "rejected").reason.message,
    /already exists/,
  );
  assert.ok(secure.has("lightpay.crypto.public.storage-owner"));
  assert.ok(!local.has("lightpay.crypto.public.storage-owner"));
  for (const value of [...local.values(), ...secure.values()])
    assert.ok(!value.includes(PHRASE));
  assert.equal((await storage.readLocalWallet("storage-owner")).id, wallet.id);
  await assert.rejects(
    storage.unlockLocalWallet("another-owner", wallet, PASSWORD),
    /active wallet/,
  );
  await storage.changeWalletPassword(
    "storage-owner",
    wallet,
    PASSWORD,
    "a completely different password",
  );
  await assert.rejects(
    storage.unlockLocalWallet("storage-owner", wallet, PASSWORD),
    /Incorrect/,
  );
  await storage.removeLocalWallet(
    "storage-owner",
    wallet,
    "a completely different password",
  );
  assert.equal(await storage.readLocalWallet("storage-owner"), null);
});

test("interrupted submissions persist before networking, prevent a second spend, and retry the same signature", async () => {
  local.clear();
  secure.clear();
  const created = await storage.createLocalWallet(
    "journal-owner",
    SECRETS,
    PASSWORD,
    false,
  );
  await fixture(
    async ({ state, raw, calls }) => {
      const quote = await prepareTransfer(
        created,
        "ETH",
        recipient.addresses.ETH,
        "0.01",
      );
      const tx = await journal.submitLocalTransfer(
        "journal-owner",
        created,
        quote,
        PASSWORD,
        () => true,
      );
      assert.equal(tx.status, "unknown");
      assert.equal(
        (await journal.readLocalTransactions("journal-owner", created.id))[0]
          .hash,
        tx.hash,
      );
      await assert.rejects(
        journal.submitLocalTransfer(
          "journal-owner",
          created,
          quote,
          PASSWORD,
          () => true,
        ),
        /pending transfer/,
      );
      state.rejectBroadcast = false;
      await assert.rejects(
        journal.retryLocalTransaction(
          "journal-owner",
          created,
          tx.hash,
          () => false,
        ),
        /wallet locked/,
      );
      assert.equal(raw.length, 1);
      const key = `lightpay.crypto.transactions.journal-owner.${created.id}`;
      const saved = local.get(key),
        tampered = JSON.parse(saved);
      tampered[0].amount = "0.02";
      local.set(key, JSON.stringify(tampered));
      await assert.rejects(
        journal.retryLocalTransaction(
          "journal-owner",
          created,
          tx.hash,
          () => true,
        ),
        /damaged/,
      );
      assert.equal(raw.length, 1);
      local.set(key, saved);
      const retried = await journal.retryLocalTransaction(
        "journal-owner",
        created,
        tx.hash,
        () => true,
      );
      assert.equal(retried.status, "pending");
      assert.equal(raw.length, 2);
      assert.equal(raw[0], raw[1]);
      state.receipt = { transactionHash: tx.hash, status: "0x1" };
      assert.equal(
        (await journal.refreshLocalTransactions("journal-owner", created.id))[0]
          .status,
        "confirmed",
      );
      const privateHex = bytesToHex(derivePrivateKey(SECRETS, "ETH"));
      for (const call of calls) {
        assert.ok(!(call.body ?? "").includes(PHRASE));
        assert.ok(!(call.body ?? "").includes(privateHex));
      }
    },
    { rejectBroadcast: true },
  );
});
