import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Decimal } from 'decimal.js';
import axios from 'axios';
import { InternationalQuote } from './international.entity';
import { FlutterwaveProvider } from './flutterwave.provider';
import { WalletsService } from '../wallets/wallets.service';
import { Transaction } from '../transactions/transaction.entity';
import { requestFingerprint } from '../common/utils';

@Injectable()
export class InternationalService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>; private running = false;
  constructor(private readonly db: DataSource, private readonly provider: FlutterwaveProvider, private readonly wallets: WalletsService) {}
  onModuleInit() { this.timer = setInterval(() => { void this.sync(); }, 30000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async quote(userId: string, authorization: string, input: Record<string, any>) {
    const corridor = this.provider.corridor(input.country);
    const banks = await this.provider.banks(input.country);
    const bank = banks.find((b) => b.code === input.bankCode);
    if (!bank) throw new BadRequestException('Bank is not supported in this country');
    const { data } = await axios.get(`${process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001'}/api/v1/auth/me`, { headers: { Authorization: authorization }, timeout: 10000 });
    const profile = data.data;
    if (profile.kycTier < 2 || profile.kycStatus !== 'approved') throw new ForbiddenException('Full identity verification required for international transfers');
    if (!profile.firstName || !profile.lastName || !profile.phoneVerified || !profile.phone) throw new BadRequestException('Complete your name and verified phone details first');
    const rate = await this.provider.rate(String(input.amount), corridor.currency);
    const fee = await this.provider.fee(rate.sourceAmount);
    const request = { account_bank: bank.code, account_number: input.accountNumber, beneficiary_name: input.recipientName,
      destination_branch_code: input.branchCode || undefined, currency: corridor.currency, debit_currency: 'NGN',
      narration: input.narration || 'LightPay transfer', amount: Number(rate.destinationAmount),
      meta: [{ sender: `${profile.firstName} ${profile.lastName}`, sender_country: 'NG', mobile_number: profile.phone }],
      country: corridor.country, bankName: bank.name,
    };
    return this.db.getRepository(InternationalQuote).save(this.db.getRepository(InternationalQuote).create({
      userId, request, sourceAmount: rate.sourceAmount, fee, destinationAmount: rate.destinationAmount, destinationCurrency: corridor.currency, expiresAt: new Date(Date.now() + 60000),
    }));
  }
  async send(userId: string, quoteId: string) {
    const quote = await this.db.getRepository(InternationalQuote).findOne({ where: { id: quoteId, userId } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.transactionId) return this.db.getRepository(Transaction).findOneByOrFail({ id: quote.transactionId, userId });
    if (quote.expiresAt <= new Date()) throw new BadRequestException('Quote expired. Review a new quote.');
    this.provider.corridor(quote.request.country);
    const rate = await this.provider.rate(quote.sourceAmount, quote.destinationCurrency), fee = await this.provider.fee(quote.sourceAmount);
    if (!new Decimal(rate.destinationAmount).eq(quote.destinationAmount) || !new Decimal(fee).eq(quote.fee)) throw new ConflictException('Rate or fee changed. Review a new quote.');
    const wallet = (await this.wallets.getUserWallets(userId)).find((w) => w.currency === 'NGN');
    if (!wallet) throw new NotFoundException('Wallet not found');
    const fingerprint = requestFingerprint({ quoteId });
    const reference = await this.wallets.paymentReference(userId, quoteId, fingerprint, 'INT');
    const tx = await this.wallets.debitWallet({ walletId: wallet.id, userId, amount: Number(quote.sourceAmount), fee: Number(quote.fee),
      type: 'transfer_out', status: 'processing', provider: 'flutterwave', reference, requestFingerprint: fingerprint,
      description: `Transfer to ${quote.request.beneficiary_name} · ${quote.request.bankName}`, metadata: {
        country: quote.request.country, destinationCurrency: quote.destinationCurrency, destinationAmount: quote.destinationAmount,
        providerRequest: quote.request, quoteId,
      },
    });
    await this.db.getRepository(InternationalQuote).update(quote.id, { transactionId: tx.id });
    await this.reconcile(tx).catch(() => {});
    return this.db.getRepository(Transaction).findOneByOrFail({ id: tx.id, userId });
  }
  async reconcile(tx: Transaction) {
    if (tx.status !== 'processing') return;
    let result = tx.providerRef ? await this.provider.transfer(tx.providerRef) : await this.provider.byReference(tx.reference);
    if (!result && await this.wallets.claimProviderRequest(tx.id)) {
      const { country, bankName, ...payload } = tx.metadata.providerRequest as Record<string, unknown>;
      result = await this.provider.send({ ...payload, reference: tx.reference });
      await this.db.getRepository(Transaction).update(tx.id, { providerRef: String(result.id), providerStatus: result.status });
    }
    if (!result) return;
    if (result.reference !== tx.reference || result.currency !== tx.metadata.destinationCurrency || !new Decimal(result.amount).eq(String(tx.metadata.destinationAmount))) throw new BadRequestException('Provider transfer mismatch');
    if (result.status === 'SUCCESSFUL') {
      // A changed provider debit must be reviewed before the app claims settlement.
      const debit = result.debit_amount;
      if (debit === undefined || !new Decimal(debit).eq(new Decimal(tx.amount).plus(tx.fee))) throw new BadRequestException('Provider debit does not match the authorized NGN total');
      await this.wallets.settleOutgoing(tx.id, 'completed', String(result.id));
    }
    if (['FAILED', 'REVERSED'].includes(result.status)) await this.wallets.settleOutgoing(tx.id, result.status === 'REVERSED' ? 'reversed' : 'failed', String(result.id));
  }
  async sync() {
    if (this.running || !this.provider.configured()) return; this.running = true;
    try {
      const transactions = await this.db.getRepository(Transaction).find({ where: { provider: 'flutterwave', status: 'processing' }, take: 50, order: { updatedAt: 'ASC' } });
      for (const tx of transactions) { await this.reconcile(tx).catch(() => {}); await this.db.getRepository(Transaction).update(tx.id, { updatedAt: new Date() }); }
    } catch { /* Provider-confirmed reconciliation resumes on the next interval. */ } finally { this.running = false; }
  }
}
