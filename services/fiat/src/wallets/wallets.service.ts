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
import { generateReference } from '../common/utils';

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

  async provisionVirtualAccount(userId: string, walletId: string, accountName: string): Promise<VirtualAccount> {
    const existing = await this.vaRepo.findOne({ where: { userId } });
    if (existing) return existing;

    const result = await this.paystackProvider.createDedicatedAccount({
      userId,
      accountName,
    });

    const va = this.vaRepo.create({
      userId,
      walletId,
      accountNumber: result.accountNumber,
      bankName: result.bankName,
      bankCode: result.bankCode,
      accountName,
      provider: 'paystack',
      providerRef: result.reference,
    });

    return this.vaRepo.save(va);
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
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: params.walletId, userId: params.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

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

      return manager.save(Transaction, tx);
    });
  }

  async debitWallet(params: {
    walletId: string;
    userId: string;
    amount: number;
    fee?: number;
    type: string;
    description?: string;
    narration?: string;
    reference?: string;
    metadata?: Record<string, unknown>;
    status?: string;
  }): Promise<Transaction> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: params.walletId, userId: params.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      const total = new Decimal(params.amount).plus(params.fee ?? 0);
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
        metadata: params.metadata ?? {},
      });

      return manager.save(Transaction, tx);
    });
  }

  async reverseTransaction(transactionId: string, userId: string): Promise<void> {
    const tx = await this.txRepo.findOne({ where: { id: transactionId, userId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.status !== 'failed' && tx.status !== 'pending') {
      throw new BadRequestException('Only failed/pending transactions can be reversed');
    }

    await this.creditWallet({
      walletId: tx.walletId,
      userId,
      amount: parseFloat(tx.amount) + parseFloat(tx.fee),
      type: 'credit',
      description: `Reversal for ${tx.reference}`,
      reference: `REV-${tx.reference}`,
    });

    await this.txRepo.update(transactionId, { status: 'reversed' });
  }
}
