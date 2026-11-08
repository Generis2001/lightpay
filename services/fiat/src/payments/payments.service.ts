import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { Decimal } from 'decimal.js';
import { PaystackProvider } from '../providers/paystack.provider';
import { WalletsService } from '../wallets/wallets.service';
import { Wallet } from '../wallets/wallet.entity';
import { VirtualAccount } from '../wallets/virtual-account.entity';
import { Transaction } from '../transactions/transaction.entity';
import { ProviderCustomer, FundingIntent } from './payment.entity';
import { notifyTransaction } from '../notifications/notification-events';
import { generateReference } from '../common/utils';

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DataSource, private readonly provider: PaystackProvider, private readonly wallets: WalletsService) {}

  private async profile(token: string) {
    const { data } = await axios.get(`${process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001'}/api/v1/auth/me`, {
      headers: { Authorization: token }, timeout: 10000,
    });
    const profile = data.data;
    if (!profile?.emailVerified || !profile.email || !profile.firstName || !profile.lastName) {
      throw new BadRequestException('A verified email address and your full name are required. Complete your profile first.');
    }
    return profile;
  }

  async provision(userId: string, token: string) {
    this.provider.assertConfigured();
    const profile = await this.profile(token);
    if (profile.kycTier < 1 || profile.kycStatus !== 'approved') throw new ForbiddenException('Identity verification is required for a receiving account');
    const wallets = await this.wallets.getUserWallets(userId);
    const wallet = wallets.find((w) => w.currency === 'NGN');
    if (!wallet) throw new NotFoundException('Wallet not found');
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`account:${userId}`]);
      const existing = await manager.findOne(VirtualAccount, { where: { userId, isActive: true } });
      if (existing) return existing;
      let customer = await manager.findOne(ProviderCustomer, { where: { userId } });
      if (!customer) {
        const result = await this.provider.getOrCreateCustomer(profile);
        customer = await manager.save(ProviderCustomer, manager.create(ProviderCustomer, {
          userId, code: result.code, customerId: result.id, email: profile.email,
        }));
      }
      const result = await this.provider.createDedicatedAccount({ customerId: customer.customerId, customerCode: customer.code });
      return manager.save(VirtualAccount, manager.create(VirtualAccount, {
        userId, walletId: wallet.id, accountNumber: result.accountNumber, bankName: result.bankName,
        bankCode: result.bankCode, accountName: result.accountName, provider: 'paystack', providerRef: result.reference,
      }));
    });
  }

  async initialize(userId: string, token: string, amount: number, idempotencyKey: string) {
    this.provider.assertConfigured();
    const profile = await this.profile(token);
    // Provider verification must be enabled before card funding is made available.
    if (profile.kycTier < 1 || profile.kycStatus !== 'approved') throw new ForbiddenException('Identity verification is required to fund your wallet');
    const wallet = (await this.wallets.getUserWallets(userId)).find((w) => w.currency === 'NGN');
    if (!wallet) throw new NotFoundException('Wallet not found');
    const reference = generateReference('TOP', `${userId}:${idempotencyKey}`);
    // Save the mapping before contacting Paystack: a timeout or process crash must
    // not leave a successful payment without a local owner.
    const claim = await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`fund:${reference}`]);
      let intent = await manager.findOne(FundingIntent, { where: { reference } });
      if (intent && (intent.userId !== userId || !new Decimal(intent.amount).eq(amount))) throw new ConflictException('Idempotency key used with a different amount');
      if (intent) return { intent, submit: false };
      intent = await manager.save(FundingIntent, manager.create(FundingIntent, {
        reference, userId, walletId: wallet.id, amount: String(amount), email: profile.email, status: 'initializing',
      }));
      return { intent, submit: true };
    });
    if (!claim.submit) return claim.intent;
    try {
      const result = await this.provider.initializePayment({ email: profile.email, amount, reference, userId });
      // Preserve a completion that may already have arrived through the webhook.
      await this.db.getRepository(FundingIntent).update({ id: claim.intent.id }, { checkoutUrl: result.authorization_url });
      await this.db.getRepository(FundingIntent).update({ id: claim.intent.id, status: 'initializing' }, { status: 'pending' });
    } catch {
      // An uncertain request is never resubmitted with a different reference.
      await this.db.getRepository(FundingIntent).update({ id: claim.intent.id, status: 'initializing' }, { status: 'unconfirmed' });
    }
    return this.db.getRepository(FundingIntent).findOneByOrFail({ id: claim.intent.id });
  }

  async checkFunding(userId: string, reference: string) {
    const intent = await this.db.getRepository(FundingIntent).findOne({ where: { userId, reference } });
    if (!intent) throw new NotFoundException('Funding request not found');
    if (intent.status !== 'completed') await this.settlePayment(reference);
    return this.db.getRepository(FundingIntent).findOne({ where: { userId, reference } });
  }

  async settlePayment(reference: string) {
    const payment = await this.provider.verifyPayment(reference);
    if (payment.reference !== reference || payment.status !== 'success') return;
    if (payment.currency !== 'NGN' || !Number.isSafeInteger(payment.amount) || payment.amount <= 0 || !Number.isSafeInteger(payment.id)) {
      throw new BadRequestException('Invalid provider payment');
    }
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`deposit:${payment.id}`]);
      const localRef = `PS-${payment.id}`;
      const existing = await manager.findOne(Transaction, { where: { reference: localRef } });
      if (existing) return existing;
      const intent = await manager.findOne(FundingIntent, { where: { reference }, lock: { mode: 'pessimistic_write' } });
      let walletId: string, userId: string;
      if (intent) {
        if (!new Decimal(intent.amount).times(100).eq(payment.amount) || intent.email.toLowerCase() !== payment.customer?.email?.toLowerCase() || payment.channel !== 'card') {
          throw new BadRequestException('Payment does not match the funding request');
        }
        walletId = intent.walletId; userId = intent.userId;
      } else {
        if (!['dedicated_nuban', 'bank_transfer'].includes(payment.channel)) return;
        const receiver = payment.authorization?.receiver_bank_account_number;
        if (!receiver) return;
        const account = await manager.findOne(VirtualAccount, { where: { accountNumber: receiver, provider: 'paystack', isActive: true } });
        if (!account) return;
        const customer = await manager.findOne(ProviderCustomer, { where: { userId: account.userId } });
        if (!customer || customer.code !== payment.customer?.customer_code) throw new BadRequestException('Receiving account customer mismatch');
        walletId = account.walletId; userId = account.userId;
      }
      const wallet = await manager.findOne(Wallet, { where: { id: walletId, userId }, lock: { mode: 'pessimistic_write' } });
      if (!wallet || wallet.currency !== 'NGN' || !wallet.isActive) throw new BadRequestException('Receiving wallet unavailable');
      const amount = new Decimal(payment.amount).div(100), before = new Decimal(wallet.balance), after = before.plus(amount);
      wallet.balance = after.toString(); wallet.ledgerBalance = after.toString(); await manager.save(Wallet, wallet);
      const tx = await manager.save(Transaction, manager.create(Transaction, {
        reference: localRef, userId, walletId, type: 'credit', status: 'completed', amount: amount.toString(), fee: '0',
        balanceBefore: before.toString(), balanceAfter: after.toString(), currency: 'NGN', provider: 'paystack',
        providerRef: reference, providerStatus: 'success', description: intent ? 'Card wallet funding' : 'Bank account deposit', completedAt: new Date(),
        metadata: { providerPaymentId: payment.id, channel: payment.channel },
      }));
      if (intent) { intent.status = 'completed'; intent.transactionId = tx.id; await manager.save(FundingIntent, intent); }
      await notifyTransaction(manager, tx);
      return tx;
    });
  }

  async settleTransfer(reference: string) {
    const tx = await this.db.getRepository(Transaction).findOne({ where: { reference, type: 'transfer_out', provider: 'paystack' } });
    if (!tx) return;
    const result = await this.provider.verifyTransfer(reference);
    if (result.reference !== reference || result.currency !== 'NGN' || !new Decimal(tx.amount).times(100).eq(result.amount)) {
      throw new BadRequestException('Transfer does not match provider confirmation');
    }
    if (['success', 'failed', 'reversed'].includes(result.status)) {
      await this.wallets.settleOutgoing(tx.id, result.status === 'success' ? 'completed' : result.status, result.transfer_code);
    }
  }
}
