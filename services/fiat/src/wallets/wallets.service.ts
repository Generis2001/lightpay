import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { Wallet } from './wallet.entity';
import { VirtualAccount } from './virtual-account.entity';
import { Transaction } from '../transactions/transaction.entity';
import { PaystackProvider } from '../providers/paystack.provider';
import { notifyTransaction } from '../notifications/notification-events';
import { enforceSpend, paymentLimits } from './limits';
import { PaymentRequest } from '../payments/payment.entity';
import { generateReference, vtpassReference } from '../common/utils';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(VirtualAccount)
    private readonly vaRepo: Repository<VirtualAccount>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly paystackProvider: PaystackProvider,
  ) {}

  async createWallet(userId: string, currency: string): Promise<Wallet> {
    if (currency !== 'NGN') throw new BadRequestException('This currency is not available yet');
    const existing = await this.walletRepo.findOne({ where: { userId, currency } });
    if (existing) {
      throw new ConflictException(`Wallet for ${currency} already exists`);
    }

    const typeMap: Record<string, string> = {
      NGN: 'naira',
      USD: 'dollar',
      BTC: 'crypto',
      ETH: 'crypto',
      SOL: 'crypto',
      BNB: 'crypto',
    };

    const wallet = this.walletRepo.create({
      userId,
      currency,
      type: typeMap[currency] ?? 'naira',
      balance: '0',
      ledgerBalance: '0',
    });

    return this.walletRepo.save(wallet);
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    // Registration is owned by auth; initialize the NGN wallet on first access.
    // Serialize initial access across devices so one user gets one wallet.
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
      const existing = await manager.findOne(Wallet, { where: { userId, currency: 'NGN' } });
      if (!existing) await manager.save(Wallet, manager.create(Wallet, {
        userId, currency: 'NGN', type: 'naira', balance: '0', ledgerBalance: '0',
      }));
    });
    return this.walletRepo.find({
      where: { userId, isActive: true },
      relations: ['virtualAccount'],
      order: { createdAt: 'ASC' },
    });
  }

  async getWallet(walletId: string, userId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId, userId },
      relations: ['virtualAccount'],
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getVirtualAccount(userId: string): Promise<VirtualAccount | null> {
    return this.vaRepo.findOne({ where: { userId, isActive: true } });
  }

  async creditWallet(params: {
    walletId: string;
    userId: string;
    amount: number;
    type: string;
    description?: string;
    narration?: string;
    reference?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Transaction> {
    if (!Number.isFinite(params.amount) || params.amount <= 0) throw new BadRequestException('Invalid credit amount');
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: params.walletId, userId: params.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      if (params.reference) {
        const existing = await manager.findOne(Transaction, { where: { reference: params.reference } });
        if (existing) {
          if (existing.userId !== params.userId || existing.walletId !== params.walletId || !new Decimal(existing.amount).eq(params.amount)) throw new ConflictException('Payment reference mismatch');
          return existing;
        }
      }
      const balanceBefore = new Decimal(wallet.balance);
      const balanceAfter = balanceBefore.plus(params.amount);

      wallet.balance = balanceAfter.toString();
      wallet.ledgerBalance = balanceAfter.toString();
      await manager.save(Wallet, wallet);

      const tx = manager.create(Transaction, {
        reference: params.reference ?? generateReference('CR'),
        userId: params.userId,
        walletId: params.walletId,
        type: params.type,
        status: 'completed',
        amount: params.amount.toString(),
        fee: '0',
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
        currency: wallet.currency,
        description: params.description ?? null,
        narration: params.narration ?? null,
        metadata: params.metadata ?? {},
        completedAt: new Date(),
      });

      const saved = await manager.save(Transaction, tx);
      await notifyTransaction(manager, saved);
      return saved;
    });
  }

  async debitWallet(params: {
    walletId: string;
    userId: string;
    amount: number;
    fee?: number;
    type: string;
    description?: string;
    narration?: string | undefined;
    reference?: string;
    metadata?: Record<string, unknown>;
    status?: string;
    provider?: string;
    requestFingerprint?: string;
  }): Promise<Transaction> {
    if (!Number.isFinite(params.amount) || params.amount <= 0 || !Number.isFinite(params.fee ?? 0) || (params.fee ?? 0) < 0) throw new BadRequestException('Invalid payment amount');
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`spend:${params.userId}`]);
      const wallet = await manager.findOne(Wallet, {
        where: { id: params.walletId, userId: params.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      if (!wallet.isActive || wallet.currency !== 'NGN') throw new BadRequestException('Wallet unavailable');
      if (params.reference) {
        const existing = await manager.findOne(Transaction, { where: { reference: params.reference } });
        if (existing) {
          if (existing.userId !== params.userId || existing.walletId !== params.walletId || existing.type !== params.type || !new Decimal(existing.amount).eq(params.amount) || existing.metadata.requestFingerprint !== params.requestFingerprint) throw new ConflictException('Idempotency key already used for a different payment');
          return existing;
        }
      }
      const total = new Decimal(params.amount).plus(params.fee ?? 0);
      await enforceSpend(manager, params.userId, total);
      const balanceBefore = new Decimal(wallet.balance);

      if (balanceBefore.lessThan(total)) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient wallet balance',
        });
      }

      const balanceAfter = balanceBefore.minus(total);
      wallet.balance = balanceAfter.toString();
      wallet.ledgerBalance = balanceAfter.toString();
      await manager.save(Wallet, wallet);

      const tx = manager.create(Transaction, {
        reference: params.reference ?? generateReference('DR'),
        userId: params.userId,
        walletId: params.walletId,
        type: params.type,
        status: params.status ?? 'pending',
        amount: params.amount.toString(),
        fee: (params.fee ?? 0).toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
        currency: wallet.currency,
        description: params.description ?? null,
        narration: params.narration ?? null,
        metadata: { ...params.metadata, requestFingerprint: params.requestFingerprint },
        provider: params.provider ?? null,
      });

      return manager.save(Transaction, tx);
    });
  }

  async reverseTransaction(transactionId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tx = await manager.findOne(Transaction, {
        where: { id: transactionId, userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!tx) throw new NotFoundException('Transaction not found');
      if (tx.status === 'reversed') return;
      if (!['failed', 'pending'].includes(tx.status)) {
        throw new BadRequestException('Only failed/pending transactions can be reversed');
      }
      const wallet = await manager.findOne(Wallet, {
        where: { id: tx.walletId, userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');
      const amount = new Decimal(tx.amount).plus(tx.fee);
      const before = new Decimal(wallet.balance);
      const after = before.plus(amount);
      wallet.balance = after.toString();
      wallet.ledgerBalance = after.toString();
      await manager.save(Wallet, wallet);
      await manager.save(Transaction, manager.create(Transaction, {
        reference: `REV-${tx.reference}`, userId, walletId: tx.walletId,
        type: 'credit', status: 'completed', amount: amount.toString(), fee: '0',
        balanceBefore: before.toString(), balanceAfter: after.toString(),
        currency: tx.currency, description: `Reversal for ${tx.reference}`, completedAt: new Date(),
      }));
      tx.status = 'reversed';
      await manager.save(Transaction, tx);
    });
  }
  async paymentReference(userId: string, key: string, fingerprint: string, prefix: string, bill = false) {
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(key)) throw new BadRequestException('A valid Idempotency-Key header is required');
    const requestKey = generateReference('REQ', `${userId}:${key}`);
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [requestKey]);
      const existing = await manager.findOne(PaymentRequest, { where: { requestKey } });
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new ConflictException('Idempotency key used for a different payment');
        return existing.reference;
      }
      const reference = bill ? vtpassReference() : generateReference(prefix);
      await manager.save(PaymentRequest, manager.create(PaymentRequest, { requestKey, reference, fingerprint }));
      return reference;
    });
  }

  async claimProviderRequest(txId: string) {
    return this.dataSource.transaction(async (manager) => {
      const tx = await manager.findOne(Transaction, { where: { id: txId }, lock: { mode: 'pessimistic_write' } });
      if (!tx || tx.status !== 'processing' || tx.metadata.providerAttemptedAt) return false;
      tx.metadata = { ...tx.metadata, providerAttemptedAt: new Date().toISOString() };
      await manager.save(Transaction, tx);
      return true;
    });
  }

  async getLimits(userId: string) { return this.dataSource.transaction((manager) => paymentLimits(manager, userId)); }

  async settleOutgoing(transactionId: string, state: 'completed' | 'failed' | 'reversed', providerRef?: string, metadata?: Record<string, unknown>) {
    return this.dataSource.transaction(async (manager) => {
      const tx = await manager.findOne(Transaction, { where: { id: transactionId }, lock: { mode: 'pessimistic_write' } });
      if (!tx) throw new NotFoundException('Transaction not found');
      if (tx.status === 'reversed' || (tx.status === 'completed' && state !== 'reversed')) return tx;
      if (!['transfer_out', 'airtime', 'data', 'electricity', 'cable'].includes(tx.type)) throw new BadRequestException('Invalid outgoing transaction');
      tx.providerRef = providerRef ?? tx.providerRef;
      tx.providerStatus = state;
      tx.metadata = { ...tx.metadata, ...metadata };
      if (state === 'completed') {
        tx.status = 'completed'; tx.completedAt = new Date();
      } else {
        const wallet = await manager.findOne(Wallet, { where: { id: tx.walletId, userId: tx.userId }, lock: { mode: 'pessimistic_write' } });
        if (!wallet) throw new NotFoundException('Wallet not found');
        const refund = new Decimal(tx.amount).plus(tx.fee);
        const before = new Decimal(wallet.balance); const after = before.plus(refund);
        wallet.balance = after.toString(); wallet.ledgerBalance = after.toString();
        await manager.save(Wallet, wallet);
        await manager.save(Transaction, manager.create(Transaction, {
          reference: `REV-${tx.reference}`, userId: tx.userId, walletId: tx.walletId, type: 'credit', status: 'completed',
          amount: refund.toString(), fee: '0', currency: tx.currency, balanceBefore: before.toString(), balanceAfter: after.toString(),
          description: `Refund for ${tx.reference}`, metadata: { originalTransactionId: tx.id }, completedAt: new Date(),
        }));
        tx.status = 'reversed';
      }
      await manager.save(Transaction, tx);
      await notifyTransaction(manager, tx);
      return tx;
    });
  }

}
