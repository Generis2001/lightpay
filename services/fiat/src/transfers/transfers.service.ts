import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { WalletsService } from '../wallets/wallets.service';
import { PaystackProvider } from '../providers/paystack.provider';
import { Transaction } from '../transactions/transaction.entity';
import { BeneficiaryService } from '../wallets/beneficiary.service';
import { generateReference, requestFingerprint } from '../common/utils';
import type { BankTransferRequest, InternalTransferRequest } from '@lightpay/types';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly walletsService: WalletsService,
    private readonly paystackProvider: PaystackProvider,
    private readonly beneficiaryService: BeneficiaryService,
  ) {}

  async resolveAccount(accountNumber: string, bankCode: string) {
    const result = await this.paystackProvider.resolveAccountNumber(accountNumber, bankCode);
    if (!result) {
      throw new BadRequestException({
        code: 'BANK_RESOLVE_FAILED',
        message: 'Could not verify this account number. Please check the details.',
      });
    }
    return result;
  }

  async getBankList() {
    return this.paystackProvider.getBankList();
  }

  async bankTransfer(userId: string, dto: BankTransferRequest & { walletId: string }, key: string): Promise<Transaction> {
    const amount = dto.amount;
    const fee = this.calculateFee(amount);
    this.paystackProvider.assertConfigured();
    const resolved = await this.resolveAccount(dto.accountNumber, dto.bankCode);
    dto.accountName = resolved.accountName; dto.bankName = resolved.bankName;
    const fingerprint = requestFingerprint({ type: 'bank', amount: dto.amount, accountNumber: dto.accountNumber, bankCode: dto.bankCode, narration: dto.narration ?? '' });
    const reference = await this.walletsService.paymentReference(userId, key, fingerprint, 'NIP');

    // Debit wallet first (optimistic debit)
    const tx = await this.walletsService.debitWallet({
      walletId: dto.walletId,
      userId,
      amount,
      fee,
      type: 'transfer_out',
      description: `Transfer to ${dto.accountName} - ${dto.bankName}`,
      narration: dto.narration ?? undefined,
      reference,
      metadata: {
        beneficiaryAccount: dto.accountNumber,
        beneficiaryBank: dto.bankCode,
        beneficiaryName: dto.accountName,
        providerRequest: { amount: dto.amount, bankCode: dto.bankCode, accountNumber: dto.accountNumber, accountName: dto.accountName, narration: dto.narration ?? '', walletId: dto.walletId },
      },
      status: 'processing', provider: 'paystack', requestFingerprint: fingerprint,
    });

    if (await this.walletsService.claimProviderRequest(tx.id)) {
      await this.initiateProviderTransfer(tx.id, userId, dto, reference, fee);
    }

    if (dto.saveBeneficiary) {
      this.beneficiaryService
        .upsertBankBeneficiary(userId, {
          name: dto.accountName,
          bankCode: dto.bankCode,
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          lastAmount: amount,
        })
        .catch(console.error);
    }

    return (await this.txRepo.findOne({ where: { id: tx.id, userId } })) ?? tx;
  }

  private async initiateProviderTransfer(
    txId: string,
    userId: string,
    dto: BankTransferRequest & { walletId: string },
    reference: string,
    fee: number,
  ): Promise<void> {
    try {
      const result = await this.paystackProvider.initiateTransfer({
        amount: dto.amount,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        narration: dto.narration ?? '',
        reference,
      });

      if (['failed', 'reversed', 'success'].includes(result.status)) {
        await this.walletsService.settleOutgoing(txId, result.status === 'success' ? 'completed' : result.status === 'reversed' ? 'reversed' : 'failed', result.transferCode);
      } else {
        await this.txRepo.update(txId, { status: 'processing', providerRef: result.transferCode, providerStatus: result.status, completedAt: null });
      }
    } catch (error) {
      // The transfer may have reached Paystack before a timeout. Reconcile its reference before refunding.
      await this.txRepo.update(txId, { providerStatus: 'unknown' });
    }
  }

  async resume(tx: Transaction) {
    if (!tx.metadata.providerAttemptedAt && await this.walletsService.claimProviderRequest(tx.id)) {
      const request = tx.metadata.providerRequest as BankTransferRequest & { walletId: string };
      if (request) await this.initiateProviderTransfer(tx.id, tx.userId, request, tx.reference, Number(tx.fee));
    }
  }

  private calculateFee(amount: number): number {
    if (amount <= 5000) return 10.75;
    if (amount <= 50000) return 25;
    return 50;
  }
}
