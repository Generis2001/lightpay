import { Injectable, BadRequestException, NotFoundException, ForbiddenException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Decimal } from 'decimal.js';
import { FireblocksProvider } from './fireblocks.provider';
import { CryptoAccount, CryptoAddress, CryptoQuote } from './crypto.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../transactions/transaction.entity';
import { getVerifiedTier } from '../wallets/limits';
import { notifyTransaction } from '../notifications/notification-events';
import { generateReference } from '../common/utils';
import type { TransactionResponse } from '@fireblocks/ts-sdk';

@Injectable()
export class CryptoService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>; private running = false;
  constructor(private readonly db: DataSource, private readonly provider: FireblocksProvider) {}
  onModuleInit() { this.timer = setInterval(() => { void this.sync(); }, 30000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async provision(userId: string, symbol: string) {
    const asset = this.provider.asset(symbol);
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`crypto:${userId}`]);
      if (await getVerifiedTier(manager, userId) < 2) throw new ForbiddenException('Full identity verification is required for crypto');
      const existing = await manager.findOne(CryptoAddress, { where: { userId, symbol, network: asset.network } });
      if (existing) return existing;
      let account = await manager.findOne(CryptoAccount, { where: { userId } });
      if (!account) account = await manager.save(CryptoAccount, manager.create(CryptoAccount, { userId, vaultId: await this.provider.createVault(userId) }));
      let wallet = await manager.findOne(Wallet, { where: { userId, currency: symbol } });
      if (!wallet) wallet = await manager.save(Wallet, manager.create(Wallet, { userId, currency: symbol, type: 'crypto', balance: '0', ledgerBalance: '0' }));
      const address = await this.provider.address(account.vaultId, asset.assetId, generateReference('ADDR', `${userId}:${symbol}`).slice(0, 40));
      return manager.save(CryptoAddress, manager.create(CryptoAddress, {
        userId, walletId: wallet.id, symbol, network: asset.network, assetId: asset.assetId, address: address.address!, tag: address.tag ?? null,
      }));
    });
  }
  async quote(userId: string, input: { symbol: string; network: string; address: string; amount: string; tag?: string }) {
    const asset = this.provider.asset(input.symbol, input.network);
    const amount = new Decimal(input.amount);
    if (!amount.isFinite() || !amount.gt(0) || amount.decimalPlaces() > asset.decimals) throw new BadRequestException('Invalid amount for this asset');
    const address = await this.provision(userId, input.symbol);
    const account = await this.db.getRepository(CryptoAccount).findOneByOrFail({ userId });
    await this.provider.validate(asset.assetId, input.address, input.tag);
    const fee = await this.provider.estimate(this.provider.request(account.vaultId, asset.assetId, input.address, amount.toString(), input.tag));
    if (typeof fee !== 'string' || !new Decimal(fee).isFinite() || new Decimal(fee).lt(0) || amount.lte(fee)) throw new BadRequestException('Amount is too small for the network fee');
    return this.db.getRepository(CryptoQuote).save(this.db.getRepository(CryptoQuote).create({
      userId, walletId: address.walletId, symbol: input.symbol, network: asset.network, address: input.address, tag: input.tag ?? null,
      amount: amount.toString(), estimatedFee: fee, expiresAt: new Date(Date.now() + 60000),
    }));
  }
  async send(userId: string, quoteId: string) {
    const tx = await this.db.transaction(async (manager) => {
      const quote = await manager.findOne(CryptoQuote, { where: { id: quoteId, userId }, lock: { mode: 'pessimistic_write' } });
      if (!quote) throw new NotFoundException('Quote not found');
      if (quote.transactionId) return manager.findOneByOrFail(Transaction, { id: quote.transactionId, userId });
      if (quote.expiresAt <= new Date()) throw new BadRequestException('Quote expired. Review a fresh network-fee estimate.');
      if (await getVerifiedTier(manager, userId) < 2) throw new ForbiddenException('Full identity verification required');
      const wallet = await manager.findOne(Wallet, { where: { id: quote.walletId, userId, isActive: true }, lock: { mode: 'pessimistic_write' } });
      if (!wallet || wallet.currency !== quote.symbol) throw new BadRequestException('Wallet unavailable');
      const amount = new Decimal(quote.amount), before = new Decimal(wallet.balance);
      if (before.lt(amount)) throw new BadRequestException('Insufficient crypto balance');
      const after = before.minus(amount); wallet.balance = after.toString(); wallet.ledgerBalance = after.toString(); await manager.save(Wallet, wallet);
      const tx = await manager.save(Transaction, manager.create(Transaction, {
        reference: generateReference('CRYPTO'), userId, walletId: wallet.id, type: 'crypto_out', status: 'processing',
        amount: amount.toString(), fee: '0', currency: quote.symbol, balanceBefore: before.toString(), balanceAfter: after.toString(),
        provider: 'fireblocks', description: `${quote.symbol} send on ${quote.network}`, metadata: { grossAmount: amount.toString(),
          address: quote.address, tag: quote.tag, network: quote.network, estimatedFee: quote.estimatedFee },
      }));
      quote.transactionId = tx.id; await manager.save(CryptoQuote, quote); return tx;
    });
    await this.reconcile(tx).catch(() => {});
    return this.db.getRepository(Transaction).findOneByOrFail({ id: tx.id, userId });
  }
  async reconcile(tx: Transaction) {
    if (tx.status !== 'processing') return;
    const account = await this.db.getRepository(CryptoAccount).findOneByOrFail({ userId: tx.userId });
    const asset = this.provider.asset(tx.currency, String(tx.metadata.network));
    let result: TransactionResponse;
    try { result = await this.provider.transaction(tx.reference); }
    catch (error: any) {
      if (error.response?.statusCode !== 404) throw error;
      await this.provider.send(this.provider.request(account.vaultId, asset.assetId, String(tx.metadata.address), String(tx.metadata.grossAmount), tx.metadata.tag as string | null), tx.reference);
      return;
    }
    const expectedAddress = String(tx.metadata.address);
    const sameAddress = ['ETH', 'BNB'].includes(tx.currency) ? result.destinationAddress?.toLowerCase() === expectedAddress.toLowerCase() : result.destinationAddress === expectedAddress;
    if (result.externalTxId !== tx.reference || result.source?.id !== account.vaultId || result.assetId !== asset.assetId || !sameAddress) throw new BadRequestException('Provider transaction mismatch');
    if (!['COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED', 'BLOCKED'].includes(result.status ?? '')) return;
    const feeText = result.feeInfo?.networkFee ?? (['CANCELLED', 'REJECTED', 'BLOCKED'].includes(result.status ?? '') ? '0' : undefined);
    const netText = result.status === 'COMPLETED' ? result.amountInfo?.netAmount : '0';
    if (typeof feeText !== 'string' || typeof netText !== 'string') throw new BadRequestException('Provider returned no precise settlement amounts');
    const gross = new Decimal(String(tx.metadata.grossAmount)), fee = new Decimal(feeText), net = new Decimal(netText);
    if (!fee.isFinite() || !net.isFinite() || fee.lt(0) || net.lt(0) || net.plus(fee).gt(gross)) throw new BadRequestException('Settlement amount exceeds authorization');
    await this.db.transaction(async (manager) => {
      const current = await manager.findOne(Transaction, { where: { id: tx.id }, lock: { mode: 'pessimistic_write' } });
      if (!current || current.status !== 'processing') return;
      const refund = gross.minus(net).minus(fee);
      if (refund.gt(0)) {
        const wallet = await manager.findOne(Wallet, { where: { id: tx.walletId, userId: tx.userId }, lock: { mode: 'pessimistic_write' } });
        if (!wallet) throw new NotFoundException('Wallet not found');
        const before = new Decimal(wallet.balance), after = before.plus(refund);
        wallet.balance = after.toString(); wallet.ledgerBalance = after.toString(); await manager.save(Wallet, wallet);
        await manager.save(Transaction, manager.create(Transaction, {
          reference: `REV-${tx.reference}`, userId: tx.userId, walletId: tx.walletId, type: 'credit', status: 'completed', amount: refund.toString(), fee: '0',
          currency: tx.currency, balanceBefore: before.toString(), balanceAfter: after.toString(), description: 'Crypto send refund', completedAt: new Date(),
        }));
      }
      current.amount = net.toString(); current.fee = fee.toString(); current.status = result.status === 'COMPLETED' ? 'completed' : fee.eq(0) ? 'reversed' : 'failed';
      current.providerRef = result.id ?? null; current.providerStatus = result.status ?? null; current.completedAt = new Date();
      current.metadata = { ...current.metadata, txHash: result.txHash, refundedAmount: refund.toString() };
      await manager.save(Transaction, current); await notifyTransaction(manager, current);
    });
  }
  async deposit(account: CryptoAccount, payment: TransactionResponse) {
    if (payment.status !== 'COMPLETED' || payment.destination?.type !== 'VAULT_ACCOUNT' || payment.destination.id !== account.vaultId || !payment.id || !payment.assetId) return;
    const address = await this.db.getRepository(CryptoAddress).findOne({ where: { userId: account.userId, assetId: payment.assetId! } });
    if (!address) return;
    const preciseAmount = payment.amountInfo?.netAmount;
    if (typeof preciseAmount !== 'string') throw new BadRequestException('Provider returned no precise deposit amount');
    const amount = new Decimal(preciseAmount);
    if (!amount.isFinite() || !amount.gt(0)) return;
    await this.db.transaction(async (manager) => {
      const reference = `FB-${payment.id}`;
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [reference]);
      if (await manager.findOne(Transaction, { where: { reference } })) return;
      const wallet = await manager.findOne(Wallet, { where: { id: address.walletId, userId: account.userId }, lock: { mode: 'pessimistic_write' } });
      if (!wallet || wallet.currency !== address.symbol || !wallet.isActive) throw new BadRequestException('Deposit wallet unavailable');
      const before = new Decimal(wallet.balance), after = before.plus(amount); wallet.balance = after.toString(); wallet.ledgerBalance = after.toString();
      await manager.save(Wallet, wallet);
      const tx = await manager.save(Transaction, manager.create(Transaction, {
        reference, userId: account.userId, walletId: wallet.id, type: 'crypto_in', status: 'completed', amount: amount.toString(), fee: '0', currency: wallet.currency,
        balanceBefore: before.toString(), balanceAfter: after.toString(), provider: 'fireblocks', providerRef: payment.id!, completedAt: new Date(),
        description: `${wallet.currency} deposit on ${address.network}`, metadata: { network: address.network, txHash: payment.txHash },
      }));
      await notifyTransaction(manager, tx);
    });
  }
  async sync() {
    if (this.running || !this.provider.configured()) return; this.running = true;
    const runner = this.db.createQueryRunner(); let acquired = false;
    try {
      await runner.connect(); const [lock] = await runner.query("SELECT pg_try_advisory_lock(hashtext('lightpay:crypto-sync')) AS acquired"); acquired = lock.acquired;
      if (!acquired) return;
      const pending = await this.db.getRepository(Transaction).find({ where: { provider: 'fireblocks', status: 'processing' }, take: 50, order: { updatedAt: 'ASC' } });
      for (const tx of pending) { await this.reconcile(tx).catch(() => {}); await this.db.getRepository(Transaction).update(tx.id, { updatedAt: new Date() }); }
      for (const account of await this.db.getRepository(CryptoAccount).find()) {
        try { for (const payment of await this.provider.completedDeposits(account.vaultId)) await this.deposit(account, payment); } catch { /* Retry provider-verified deposits on the next pass. */ }
      }
    } catch { /* Retry without fabricating a completion or refund. */ }
    finally { if (acquired) await runner.query("SELECT pg_advisory_unlock(hashtext('lightpay:crypto-sync'))").catch(() => {}); await runner.release(); this.running = false; }
  }
}
