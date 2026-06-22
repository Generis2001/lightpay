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
import { generateReference } from '../common/utils';
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

  async bankTransfer(userId: string, dto: BankTransferRequest & { walletId: string }): Promise<Transaction> {
    const amount = dto.amount;
    const fee = this.calculateFee(amount);
    const reference = generateReference('NIP');

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
      },
      status: 'processing',
    });

    // Initiate transfer via Paystack (async)
    this.initiateProviderTransfer(tx.id, userId, dto, reference, fee).catch((err) => {
      console.error('Provider transfer failed, reversing:', err);
      this.walletsService.reverseTransaction(tx.id, userId).catch(console.error);
    });

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

    return tx;
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

      await this.txRepo.update(txId, {
        status: 'completed',
        providerRef: result.transferCode,
        providerStatus: 'success',
        completedAt: new Date(),
      });
    } catch (error) {
      await this.txRepo.update(txId, {
        status: 'failed',
        providerStatus: 'failed',
      });
      throw error;
    }
  }

  private calculateFee(amount: number): number {
    if (amount <= 5000) return 10.75;
    if (amount <= 50000) return 25;
    return 50;
  }
}
