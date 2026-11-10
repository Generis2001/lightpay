const { test } = require("node:test");
const assert = require("node:assert/strict");
require("reflect-metadata");
require("ts-node").register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: "commonjs",
    target: "es2022",
    esModuleInterop: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  },
});
const express = require("express");
const { NestFactory } = require("@nestjs/core");
const { Module } = require("@nestjs/common");
const { ConfigModule } = require("@nestjs/config");
const {
  ProxyModule,
} = require("../services/gateway/src/proxy/proxy.module.ts");
const { AuthService } = require("../services/auth/src/auth/auth.service.ts");
const {
  TransactionPinGuard,
} = require("../services/fiat/src/common/guards/transaction-pin.guard.ts");
const {
  BillsController,
} = require("../services/fiat/src/bills/bills.controller.ts");
const {
  TransfersController,
} = require("../services/fiat/src/transfers/transfers.controller.ts");
const {
  TransfersService,
} = require("../services/fiat/src/transfers/transfers.service.ts");
const {
  WalletsService,
} = require("../services/fiat/src/wallets/wallets.service.ts");
const { Wallet } = require("../services/fiat/src/wallets/wallet.entity.ts");
const {
  Transaction,
} = require("../services/fiat/src/transactions/transaction.entity.ts");
const { GUARDS_METADATA } = require("@nestjs/common/constants");
const { CryptoController } = require("../services/fiat/src/crypto/crypto.module.ts");
const { InternationalController } = require("../services/fiat/src/international/international.module.ts");

async function listen(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
const close = (server) => new Promise((resolve) => server.close(resolve));

test("gateway forwards collection routes, nested routes, queries, auth headers and payment bodies", async () => {
  const upstream = express();
  upstream.use(express.json({ verify: (req, _res, buffer) => { req.raw = buffer.toString(); } }));
  upstream.use((req, res) =>
    res.json({
      path: req.originalUrl,
      method: req.method,
      body: req.body,
      authorization: req.headers.authorization,
      raw: req.raw,
    }),
  );
  const fixture = await listen(upstream);
  let app;
  try {
    class TestModule {}
    Module({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              app: { services: { auth: fixture.url, fiat: fixture.url } },
            }),
          ],
        }),
        ProxyModule,
      ],
    })(TestModule);
    app = await NestFactory.create(TestModule, { logger: false, bodyParser: false });
    app.setGlobalPrefix("api/v1");
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    for (const path of [
      "/wallets",
      "/wallets/virtual-account",
      "/transactions?limit=5",
      "/transfers/banks",
      "/bills/data/plans?network=MTN",
    ]) {
      const response = await fetch(`${url}/api/v1${path}`, {
        headers: { Authorization: "Bearer fixture-token" },
      });
      assert.equal(response.status, 200, path);
      const body = await response.json();
      assert.equal(body.path, path);
      assert.equal(body.authorization, "Bearer fixture-token");
    }
    for (const path of [
      "/auth/otp/verify",
      "/transfers/bank",
      "/bills/airtime",
    ]) {
      const response = await fetch(`${url}/api/v1${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "948372", amount: 500 }),
      });
      assert.equal(response.status, 200, path);
      const body = await response.json();
      assert.equal(
        body.path,
        path.startsWith("/auth") ? `/api/v1${path}` : path,
      );
      assert.deepEqual(body.body, { pin: "948372", amount: 500 });
    }
    const rawWebhook = '{ "event" : "charge.success", "data" : {"reference":"fixture"} }';
    const webhook = await fetch(`${url}/api/v1/webhooks/paystack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: rawWebhook });
    assert.equal((await webhook.json()).raw, rawWebhook);
    assert.equal((await fetch(`${url}/api/v1/unknown`)).status, 404);
  } finally {
    if (app) await app.close();
    await close(fixture.server);
  }
});

test("registration supplies usable access and refresh tokens before PIN setup", async () => {
  const payloads = [];
  const service = new AuthService(
    {},
    {},
    {
      sign: (payload) => {
        payloads.push(payload);
        return `token-${payload.type}`;
      },
    },
    { get: () => undefined },
    { verifyOtp: async () => {} },
    {},
    { create: async (userId) => {
      payloads.push({ sub: userId, type: 'access' }, { sub: userId, type: 'refresh' });
      return { accessToken: 'token-access', refreshToken: 'token-refresh' };
    } },
  );
  service.createUser = async () => ({ id: "user-1" });
  const response = await service.verifyOtp(
    {
      purpose: "registration",
      identifier: "fixture@example.com",
      method: "email",
      code: "123456",
    },
    "127.0.0.1",
  );
  assert.equal(response.data.tokens.accessToken, "token-access");
  assert.equal(response.data.tokens.refreshToken, "token-refresh");
  assert.equal(payloads[0].sub, "user-1");
});

test('registration and login use the same normalized email for OTPs, user creation and lookup', async () => {
  const observed = [];
  const user = { id: 'email-case-user', isActive: true, isBlocked: false };
  const service = new AuthService(
    { findOne: async ({ where }) => { observed.push(['lookup', where.email]); return user; }, save: async value => value },
    {}, {}, {},
    { sendOtp: async value => observed.push(['send', value.identifier]), verifyOtp: async value => observed.push(['verify', value.identifier]) },
    {}, { create: async () => ({ accessToken: 'case-test-access', refreshToken: 'case-test-refresh' }) },
  );
  service.createUser = async identifier => { observed.push(['create', identifier]); return user; };
  await service.verifyOtp({ identifier: ' User+TEST@Example.Invalid ', method: 'email', purpose: 'registration', code: '123456' }, '127.0.0.1');
  await service.requestLoginOtp({ identifier: 'USER+test@EXAMPLE.INVALID', method: 'email' }, '127.0.0.1');
  await service.verifyOtp({ identifier: 'USER+TEST@example.invalid', method: 'email', purpose: 'login', code: '123456' }, '127.0.0.1');
  assert.ok(observed.length >= 6);
  for (const [, identifier] of observed) assert.equal(identifier, 'user+test@example.invalid');
});

test("an existing transaction PIN cannot be replaced through initial PIN setup", async () => {
  const service = new AuthService(
    {},
    { findOne: async () => ({ pinHash: "existing-hash" }) },
    {},
    {},
    {},
    {},
  );
  await assert.rejects(
    service.setPinForUser("user-1", "948372"),
    /Use Change PIN/,
  );
});

test("all outgoing fiat routes require server PIN validation", () => {
  for (const [controller, route] of [
    [TransfersController, "bankTransfer"],
    [BillsController, "purchaseAirtime"],
    [BillsController, "purchaseData"],
    [BillsController, "payElectricity"],
    [BillsController, "payCable"],
    [CryptoController, "send"],
    [InternationalController, "send"],
  ]) {
    assert.ok(
      Reflect.getMetadata(
        GUARDS_METADATA,
        controller.prototype[route],
      ).includes(TransactionPinGuard),
      route,
    );
  }
});

test("PIN verification rejects incorrect, missing and unavailable checks and forwards the user token", async () => {
  const upstream = express();
  upstream.use(express.json());
  upstream.post("/api/v1/auth/pin/verify", (req, res) => {
    assert.equal(req.headers.authorization, "Bearer fixture-token");
    if (req.body.pin === "948372") res.json({ data: { verified: true } });
    else res.status(401).json({ message: "Incorrect PIN" });
  });
  const fixture = await listen(upstream);
  const previousUrl = process.env.AUTH_SERVICE_URL;
  process.env.AUTH_SERVICE_URL = fixture.url;
  const context = (pin) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        body: { pin },
        headers: { authorization: "Bearer fixture-token" },
      }),
    }),
  });
  try {
    const guard = new TransactionPinGuard();
    assert.equal(await guard.canActivate(context("948372")), true);
    await assert.rejects(guard.canActivate(context("000000")), /Incorrect PIN/);
    await assert.rejects(guard.canActivate(context("")), /6-digit/);
    await close(fixture.server);
    await assert.rejects(
      guard.canActivate(context("948372")),
      /Unable to verify PIN/,
    );
  } finally {
    if (fixture.server.listening) await close(fixture.server);
    if (previousUrl === undefined) delete process.env.AUTH_SERVICE_URL;
    else process.env.AUTH_SERVICE_URL = previousUrl;
  }
});

test("a provider transfer still processing is not marked completed", async () => {
  const updates = [];
  const service = new TransfersService(
    { update: async (_id, update) => updates.push(update) },
    {},
    {
      initiateTransfer: async () => ({
        status: "pending",
        transferCode: "fixture",
      }),
    },
    {},
  );
  await service.initiateProviderTransfer(
    "tx-1",
    "user-1",
    {
      amount: 500,
      bankCode: "001",
      accountNumber: "0000000000",
      accountName: "Fixture",
    },
    "reference",
    10.75,
  );
  assert.equal(updates[0].status, "processing");
  assert.equal(updates[0].completedAt, null);
});

test("repeated reversal returns amount plus fee exactly once", async () => {
  const tx = {
    id: "tx-1",
    userId: "user-1",
    walletId: "wallet-1",
    status: "failed",
    reference: "fixture",
    amount: "500",
    fee: "10.75",
    currency: "NGN",
  };
  const wallet = { balance: "100", ledgerBalance: "100" };
  const credits = [];
  const manager = {
    findOne: async (entity, options) => {
      assert.equal(options.lock.mode, "pessimistic_write");
      return entity === Wallet ? wallet : tx;
    },
    create: (_entity, value) => value,
    save: async (entity, value) => {
      if (entity === Transaction && value.type === "credit")
        credits.push(value);
      return value;
    },
  };
  const service = new WalletsService(
    {},
    {},
    {},
    { transaction: async (callback) => callback(manager) },
    {},
  );
  await service.reverseTransaction("tx-1", "user-1");
  await service.reverseTransaction("tx-1", "user-1");
  assert.equal(wallet.balance, "610.75");
  assert.equal(tx.status, "reversed");
  assert.equal(credits.length, 1);
  assert.equal(credits[0].amount, "510.75");
});
