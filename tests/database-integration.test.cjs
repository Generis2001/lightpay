const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: { module: 'CommonJS', target: 'es2022', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } });
const { DataSource } = require('typeorm');
const { Client } = require('pg');
const { JwtService } = require('@nestjs/jwt');
const { User } = require('../services/auth/src/users/user.entity.ts');
const { AuthSession } = require('../services/auth/src/auth/session.entity.ts');
const { SessionsService } = require('../services/auth/src/auth/sessions.service.ts');
const { OtpChallenge } = require('../services/auth/src/otp/otp.entity.ts');
const { OtpService } = require('../services/auth/src/otp/otp.service.ts');
const { Wallet } = require('../services/fiat/src/wallets/wallet.entity.ts');
const { VirtualAccount } = require('../services/fiat/src/wallets/virtual-account.entity.ts');
const { Transaction } = require('../services/fiat/src/transactions/transaction.entity.ts');
const { WalletsService } = require('../services/fiat/src/wallets/wallets.service.ts');
const { PaymentsService } = require('../services/fiat/src/payments/payments.service.ts');
const { FundingIntent, ProviderCustomer } = require('../services/fiat/src/payments/payment.entity.ts');
const { Notification } = require('../services/fiat/src/notifications/notification.entity.ts');
const { PushDevice, PushDelivery } = require('../services/fiat/src/notifications/notification.entity.ts');
const { NotificationsService } = require('../services/fiat/src/notifications/notifications.service.ts');
const { CryptoService } = require('../services/fiat/src/crypto/crypto.service.ts');
const { CryptoAccount, CryptoAddress } = require('../services/fiat/src/crypto/crypto.entity.ts');
const { FireblocksProvider } = require('../services/fiat/src/crypto/fireblocks.provider.ts');
const { PaystackProvider } = require('../services/fiat/src/providers/paystack.provider.ts');
const { BillsService } = require('../services/fiat/src/bills/bills.service.ts');
const { FlutterwaveProvider } = require('../services/fiat/src/international/flutterwave.provider.ts');
const enabled = !!process.env.LIGHTPAY_TEST_DATABASE_URL;
const dbtest = (name, run) => test(name, { skip: !enabled }, run);
let authDb, fiatDb, admin, databaseName, testConnectionUrl;
const secret = 'local-regression-test-secret-not-a-production-key';
const config = { get: (name) => ({ 'app.jwtSecret': secret, 'app.jwtExpiresIn': '15m', 'app.refreshTokenExpiresIn': '30d', 'app.otpMaxAttempts': 2 })[name], getOrThrow: (name) => name === 'app.jwtSecret' ? secret : undefined };
const jwt = new JwtService({ secret });
const authRepo = (entity) => authDb.getRepository(entity);
const fiatRepo = (entity) => fiatDb.getRepository(entity);
const walletsService = () => new WalletsService(fiatRepo(Wallet), fiatRepo(VirtualAccount), fiatRepo(Transaction), fiatDb, {});
async function user(tier = 0) {
  return authRepo(User).save(authRepo(User).create({ email: `${randomUUID()}@example.invalid`, firstName: 'Ada', lastName: 'Test', phoneVerified: true, emailVerified: true, kycTier: tier, kycStatus: tier ? 'approved' : 'pending' }));
}
async function wallet(owner, balance = '50000', currency = 'NGN') {
  return fiatRepo(Wallet).save(fiatRepo(Wallet).create({ userId: owner.id, currency, type: currency === 'NGN' ? 'naira' : 'crypto', balance, ledgerBalance: balance }));
}
before(async () => {
  if (!enabled) return;
  const uri = new URL(process.env.LIGHTPAY_TEST_DATABASE_URL);
  admin = new Client({ connectionString: uri.toString() }); await admin.connect();
  databaseName = `lightpay_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE ${databaseName}`);
  uri.pathname = `/${databaseName}`; testConnectionUrl = uri.toString();
  const connection = new Client({ connectionString: uri.toString() }); await connection.connect();
  await connection.query('CREATE SCHEMA auth'); await connection.query('CREATE SCHEMA fiat'); await connection.end();
  for (const schema of ['auth', 'fiat']) {
    const db = new DataSource({ type: 'postgres', url: uri.toString(), schema, entities: [`${__dirname}/../services/${schema}/src/**/*.entity.ts`], migrations: [`${__dirname}/../services/${schema}/src/database/migrations/*.ts`], synchronize: false });
    await db.initialize(); await db.runMigrations({ transaction: 'all' });
    assert.equal((await db.runMigrations()).length, 0, 'migrations can be reapplied without altering data');
    if (schema === 'auth') authDb = db; else fiatDb = db;
  }
});
after(async () => {
  if (authDb?.isInitialized) await authDb.destroy(); if (fiatDb?.isInitialized) await fiatDb.destroy();
  if (admin) { if (databaseName) await admin.query(`DROP DATABASE ${databaseName} WITH (FORCE)`); await admin.end(); }
});
dbtest('refresh rotates once, detects replay, revokes access and checks device identity', async () => {
  const owner = await user(); const sessions = new SessionsService(authRepo(AuthSession), authRepo(User), jwt, config);
  const initial = await sessions.create(owner.id, 'device-test'); const payload = jwt.verify(initial.accessToken);
  await assert.rejects(sessions.refresh(initial.accessToken, 'device-test'), /Invalid refresh/);
  await assert.rejects(sessions.refresh(initial.refreshToken, 'another-device'), /device/);
  const refreshed = await sessions.refresh(initial.refreshToken, 'device-test'); assert.notEqual(refreshed.refreshToken, initial.refreshToken);
  await sessions.validate(owner.id, payload.sessionId);
  await assert.rejects(sessions.refresh(initial.refreshToken, 'device-test'), /already used/);
  await assert.rejects(sessions.validate(owner.id, payload.sessionId), /revoked/);
  await assert.rejects(sessions.refresh(refreshed.refreshToken, 'device-test'), /revoked/);
});
dbtest('logout revokes only the authenticated session and blocked users cannot refresh', async () => {
  const owner = await user(); const sessions = new SessionsService(authRepo(AuthSession), authRepo(User), jwt, config);
  const first = await sessions.create(owner.id), second = await sessions.create(owner.id);
  await sessions.revoke(owner.id, jwt.verify(first.accessToken).sessionId);
  await assert.rejects(sessions.validate(owner.id, jwt.verify(first.accessToken).sessionId));
  await sessions.validate(owner.id, jwt.verify(second.accessToken).sessionId);
  await authRepo(User).update(owner.id, { isBlocked: true }); await assert.rejects(sessions.refresh(second.refreshToken), /unavailable/);
});
dbtest('OTP verification persists failed attempts and permits only one concurrent use', async () => {
  const otp = new OtpService(config, authRepo(OtpChallenge)); const params = { method: 'email', identifier: `${randomUUID()}@example.invalid`, purpose: 'login' };
  let delivered; otp.sendEmail = async (_email, code) => { delivered = code; };
  await otp.sendOtp(params); await assert.rejects(otp.verifyOtp({ ...params, code: '999999' }), /Incorrect/);
  const uses = await Promise.allSettled([otp.verifyOtp({ ...params, code: delivered }), otp.verifyOtp({ ...params, code: delivered })]);
  assert.equal(uses.filter(x => x.status === 'fulfilled').length, 1);
  const again = { ...params, identifier: `${randomUUID()}@example.invalid` }; await otp.sendOtp(again);
  await assert.rejects(otp.verifyOtp({ ...again, code: 'invalid' })); await assert.rejects(otp.verifyOtp({ ...again, code: 'invalid' }));
  await assert.rejects(otp.verifyOtp({ ...again, code: delivered }), /Too many/);
});
dbtest('daily limits serialize concurrent debits and the same request debits once', async () => {
  const owner = await user(), account = await wallet(owner); const service = walletsService();
  const args = (ref, amount) => ({ userId: owner.id, walletId: account.id, amount, type: 'transfer_out', status: 'processing', reference: ref, requestFingerprint: 'fixture' });
  const result = await Promise.allSettled([service.debitWallet(args(randomUUID(), 15000)), service.debitWallet(args(randomUUID(), 15000))]);
  assert.equal(result.filter(x => x.status === 'fulfilled').length, 1);
  const key = randomUUID(); const duplicate = await Promise.all([service.debitWallet(args(key, 5000)), service.debitWallet(args(key, 5000))]);
  assert.equal(duplicate[0].id, duplicate[1].id); assert.equal((await fiatRepo(Wallet).findOneByOrFail({ id: account.id })).balance, '30000.000000000000000000');
  await assert.rejects(service.debitWallet(args(key, 4000)), /different payment/);
});
dbtest('provider failure and duplicated reversals refund once; late success cannot resurrect a refund', async () => {
  const owner = await user(1), account = await wallet(owner, '10000'); const service = walletsService();
  const tx = await service.debitWallet({ walletId: account.id, userId: owner.id, amount: 500, fee: 10.75, type: 'transfer_out', status: 'processing' });
  await Promise.all([service.settleOutgoing(tx.id, 'failed'), service.settleOutgoing(tx.id, 'reversed')]);
  await service.settleOutgoing(tx.id, 'completed');
  assert.equal((await fiatRepo(Wallet).findOneByOrFail({ id: account.id })).balance, '10000.000000000000000000');
  assert.equal((await fiatRepo(Transaction).findOneByOrFail({ id: tx.id })).status, 'reversed');
  assert.equal(await fiatRepo(Transaction).countBy({ reference: `REV-${tx.reference}` }), 1);
});
dbtest('verified card deposits reject wrong amounts and credit duplicate events once', async () => {
  const owner = await user(1), account = await wallet(owner, '0'); const reference = randomUUID();
  await fiatRepo(FundingIntent).save(fiatRepo(FundingIntent).create({ userId: owner.id, walletId: account.id, reference, amount: '1250', email: owner.email }));
  const payment = { id: 9123456, reference, currency: 'NGN', status: 'success', amount: 125000, channel: 'card', customer: { email: owner.email } };
  const service = new PaymentsService(fiatDb, { verifyPayment: async () => payment }, walletsService());
  payment.amount = 124000; await assert.rejects(service.settlePayment(reference), /does not match/); payment.amount = 125000;
  await Promise.all([service.settlePayment(reference), service.settlePayment(reference)]);
  assert.equal((await fiatRepo(Wallet).findOneByOrFail({ id: account.id })).balance, '1250.000000000000000000');
  assert.equal(await fiatRepo(Notification).countBy({ userId: owner.id }), 1);
});
dbtest('a checkout timeout preserves its owner mapping, is not resubmitted, and can settle later', async () => {
  const owner = await user(1), account = await wallet(owner, '0'); let calls = 0;
  let reference;
  const provider = {
    assertConfigured: () => {},
    initializePayment: async (request) => {
      calls++; reference = request.reference;
      const intent = await fiatRepo(FundingIntent).findOneByOrFail({ reference });
      assert.equal(intent.userId, owner.id);
      throw new Error('uncertain provider timeout');
    },
    verifyPayment: async () => ({ id: 9234567, reference, currency: 'NGN', status: 'success', amount: 100000, channel: 'card', customer: { email: owner.email } }),
  };
  const service = new PaymentsService(fiatDb, provider, walletsService()); service.profile = async () => owner;
  const key = randomUUID();
  const first = await service.initialize(owner.id, 'fixture-token', 1000, key);
  const retry = await service.initialize(owner.id, 'fixture-token', 1000, key);
  assert.equal(first.reference, retry.reference); assert.equal(calls, 1); assert.equal(first.status, 'unconfirmed');
  await assert.rejects(service.initialize(owner.id, 'fixture-token', 2000, key), /different amount/);
  await service.settlePayment(first.reference);
  assert.equal((await fiatRepo(Wallet).findOneByOrFail({ id: account.id })).balance, '1000.000000000000000000');
});
dbtest('queued push notifications are suppressed after the device session is revoked', async () => {
  const owner = await user(1), account = await wallet(owner, '0');
  const sessions = new SessionsService(authRepo(AuthSession), authRepo(User), jwt, config);
  const tokens = await sessions.create(owner.id, 'push-test-device');
  const notifications = new NotificationsService(fiatDb);
  await notifications.register(owner.id, 'push-test-device', 'ExpoPushToken[test-device]');
  await walletsService().creditWallet({ userId: owner.id, walletId: account.id, amount: 100, type: 'credit' });
  const device = await fiatRepo(PushDevice).findOneByOrFail({ userId: owner.id });
  assert.equal(await fiatRepo(PushDelivery).countBy({ deviceId: device.id }), 1);
  await sessions.revoke(owner.id, jwt.verify(tokens.accessToken).sessionId);
  const axios = require('axios'); const previous = axios.post; let sent = 0;
  axios.post = async () => { sent++; return { data: { data: { status: 'ok', id: 'test-ticket' } } }; };
  try { await notifications.deliver(); } finally { axios.post = previous; }
  const job = await fiatRepo(PushDelivery).findOneByOrFail({ deviceId: device.id });
  assert.equal(sent, 0); assert.ok(job.sentAt); assert.equal(job.ticketId, null);
});
dbtest('crypto provisioning is serialized and duplicate deposits retain full 18-digit precision', async () => {
  const owner = await user(2); let vaultCalls = 0;
  const provider = { asset: () => ({ network: 'Ethereum', assetId: 'ETH', decimals: 18 }), createVault: async () => { vaultCalls++; return randomUUID(); }, address: async () => ({ address: '0x1111111111111111111111111111111111111111' }) };
  const service = new CryptoService(fiatDb, provider);
  const [a,b] = await Promise.all([service.provision(owner.id, 'ETH'), service.provision(owner.id, 'ETH')]); assert.equal(a.id,b.id); assert.equal(vaultCalls,1);
  const vault = await fiatRepo(CryptoAccount).findOneByOrFail({ userId: owner.id });
  const payment = { id: randomUUID(), status: 'COMPLETED', assetId:'ETH', destination:{ type:'VAULT_ACCOUNT', id:vault.vaultId }, amountInfo:{ netAmount:'0.000000000000000001' }, txHash:'test-only-hash' };
  await Promise.all([service.deposit(vault,payment), service.deposit(vault,payment)]);
  assert.equal((await fiatRepo(Wallet).findOneByOrFail({ id:a.walletId })).balance,'0.000000000000000001');
});
dbtest('crypto send reserves the authorized total and a mined failure refunds only the unspent amount', async () => {
  const owner = await user(2), account = await wallet(owner, '2', 'ETH'); const vault = await fiatRepo(CryptoAccount).save(fiatRepo(CryptoAccount).create({ userId: owner.id, vaultId: randomUUID() }));
  const destination = '0x2222222222222222222222222222222222222222';
  const tx = await fiatRepo(Transaction).save(fiatRepo(Transaction).create({ userId:owner.id,walletId:account.id,reference:randomUUID(),type:'crypto_out',status:'processing',currency:'ETH',amount:'1',fee:'0',balanceBefore:'3',balanceAfter:'2',provider:'fireblocks',metadata:{grossAmount:'1',network:'Ethereum',address:destination} }));
  const provider = { asset:()=>({assetId:'ETH'}),transaction:async()=>({id:randomUUID(),externalTxId:tx.reference,source:{id:vault.vaultId},assetId:'ETH',destinationAddress:destination,status:'FAILED',feeInfo:{networkFee:'0.001'},amountInfo:{netAmount:'0'}}) };
  const service = new CryptoService(fiatDb,provider); await Promise.all([service.reconcile(tx),service.reconcile(tx)]);
  assert.equal((await fiatRepo(Wallet).findOneByOrFail({id:account.id})).balance,'2.999000000000000000');
  const settled = await fiatRepo(Transaction).findOneByOrFail({id:tx.id});assert.equal(settled.fee,'0.001000000000000000');assert.equal(settled.status,'failed');
});
test('Paystack webhooks fail closed without a secret and validate original payload bytes', async () => {
  const {createHmac} = require('node:crypto'); const provider = new PaystackProvider({get:()=>secret}); const body = Buffer.from('{ "event": "charge.success" }');
  const signature = createHmac('sha512',secret).update(body).digest('hex'); assert.equal(await provider.verifyWebhook(body,signature),true);
  assert.equal(await provider.verifyWebhook(Buffer.from('{}'),signature),false);assert.equal(await provider.verifyWebhook(body,'invalid'),false);
});
test('VTpass pending and timeout responses remain processing, and server quotes reject stale prices', async () => {
  const service = new BillsService({get:()=> 'test-provider-key'}, {}, {});
  assert.equal(service.parseResult({code:'000',content:{transactions:{status:'pending'}}}).status,'processing');
  assert.equal(service.parseResult({code:'000',content:{transactions:{status:'delivered'}}}).status,'completed');
  service.client.post=async()=>{throw new Error('test timeout');};assert.equal((await service.vtpassPay({})).status,'processing');
  service.getDataPlans=async()=>[{code:'test-plan',amount:500}];await assert.rejects(service.purchaseData({userId:'test',walletId:'test',network:'MTN',phone:'08000000000',planCode:'test-plan',amount:400,idempotencyKey:randomUUID()}),/price changed/);
});
test('unsupported crypto networks and unactivated bank corridors cannot be used', () => {
  const provider = new FireblocksProvider(); assert.throws(()=>provider.asset('ETH','BNB Smart Chain'),/do not match/); assert.throws(()=>provider.asset('constructor'),/Unsupported/);
  const flutterwave = new FlutterwaveProvider(); assert.throws(()=>flutterwave.corridor('US'),/not been activated/);
});

dbtest('startup migrations use DATABASE_URL and safely reopen existing schemas', async () => {
  const previous = process.env.DATABASE_URL, previousSsl = process.env.DATABASE_SSL;
  process.env.DATABASE_URL = testConnectionUrl; process.env.DATABASE_SSL = 'false';
  try {
    await require('../services/auth/src/database/migrate.ts').migrateDatabase();
    await require('../services/fiat/src/database/migrate.ts').migrateDatabase();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    if (previousSsl === undefined) delete process.env.DATABASE_SSL; else process.env.DATABASE_SSL = previousSsl;
  }
});
dbtest('standalone migrations load the local database URL before constructing either connection', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lightpay-migration-env-'));
  const previousDirectory = process.cwd();
  const previous = process.env.DATABASE_URL, previousSsl = process.env.DATABASE_SSL;
  try {
    await fs.writeFile(path.join(directory, '.env.local'), `DATABASE_URL=${testConnectionUrl}\nDATABASE_SSL=false\n`);
    delete process.env.DATABASE_URL; delete process.env.DATABASE_SSL;
    process.chdir(directory);
    await require('../services/auth/src/database/migrate.ts').migrateDatabase();
    assert.equal(process.env.DATABASE_URL, testConnectionUrl);
    await require('../services/fiat/src/database/migrate.ts').migrateDatabase();
  } finally {
    process.chdir(previousDirectory);
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    if (previousSsl === undefined) delete process.env.DATABASE_SSL; else process.env.DATABASE_SSL = previousSsl;
    await fs.rm(directory, { recursive: true });
  }
});
dbtest('KYC uses matched provider evidence, blocks identity reuse and keeps verified names fixed', async () => {
  const { KycController } = require('../services/auth/src/kyc/kyc.module.ts');
  const { AuthService } = require('../services/auth/src/auth/auth.service.ts');
  const owner = await user(); await authRepo(User).update(owner.id, { phone: '+2348012345678' });
  const previous = process.env.PREMBLY_IDENTITY_HASH_KEY; process.env.PREMBLY_IDENTITY_HASH_KEY = 'local-identity-hash-secret-for-tests';
  try {
    const proof = { firstName:'Ada',lastName:'Test',dateOfBirth:'1990-01-01',reference:'test-provider-evidence',faceMatched:true,livenessConfirmed:true };
    const controller = new KycController(authDb, { configured:()=>true, verify:async()=>proof });
    const input = {type:'bvn',number:'12345678901',image:'test-only-image',dateOfBirth:'1990-01-01',consent:true};
    proof.firstName='Different'; await assert.rejects(controller.verify({user:{sub:owner.id}},input),/do not match/);
    proof.firstName='Ada'; const result = await controller.verify({user:{sub:owner.id}},input); assert.equal(result.data.tier,1);
    const another = await user(); await authRepo(User).update(another.id,{phone:'+2348012345679'});
    await assert.rejects(controller.verify({user:{sub:another.id}},input),/already linked/);
    const auth = new AuthService(authRepo(User), {}, {}, {}, {}, {}, {});
    await assert.rejects(auth.updateProfile(owner.id,{firstName:'Different',lastName:'Test'}),/Verified names/);
  } finally { if(previous===undefined) delete process.env.PREMBLY_IDENTITY_HASH_KEY; else process.env.PREMBLY_IDENTITY_HASH_KEY=previous; }
});
test('Prembly transport success alone cannot establish face matching or liveness', () => {
  const {confirmedFace,confirmedLiveness,identityDate} = require('../services/auth/src/kyc/prembly.provider.ts');
  assert.equal(confirmedFace({status:true,response_code:'00',message:'Face Mismatch'}),false);
  assert.equal(confirmedFace({status:true,response_code:'00',message:'Face Match'}),true);
  assert.equal(confirmedLiveness({status:true,response_code:'00',data:{confidence:0.1}}),false);
  assert.equal(confirmedLiveness({status:true,response_code:'00',data:{confidence:0.999}}),true);
  assert.equal(identityDate('11-May-1992'),'1992-05-11'); assert.throws(()=>identityDate('1992-02-31'),/Invalid/);
});
