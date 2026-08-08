import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface ResolvedAccount {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

interface Bank {
  code: string;
  name: string;
  logo?: string;
}

interface TransferResult {
  transferCode: string;
  reference: string;
  status: string;
}

interface DedicatedAccountResult {
  accountNumber: string;
  bankName: string;
  bankCode: string;
  reference: string;
}

@Injectable()
export class PaystackProvider {
  private readonly client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${config.get('app.paystackSecretKey') ?? process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async resolveAccountNumber(
    accountNumber: string,
    bankCode: string,
  ): Promise<ResolvedAccount | null> {
    try {
      const { data } = await this.client.get('/bank/resolve', {
        params: { account_number: accountNumber, bank_code: bankCode },
      });
      return {
        accountName: data.data.account_name,
        accountNumber,
        bankCode,
        bankName: await this.getBankName(bankCode),
      };
    } catch (error) {
      return null;
    }
  }

  async getBankList(): Promise<Bank[]> {
    const { data } = await this.client.get('/bank', {
      params: { country: 'nigeria', perPage: 100 },
    });
    return data.data.map((bank: { code: string; name: string }) => ({
      code: bank.code,
      name: bank.name,
    }));
  }

  async initiateTransfer(params: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    narration: string;
    reference: string;
  }): Promise<TransferResult> {
    // Create transfer recipient
    const { data: recipientData } = await this.client.post('/transferrecipient', {
      type: 'nuban',
      name: params.accountName,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: 'NGN',
    });

    // Initiate transfer
    const { data: transferData } = await this.client.post('/transfer', {
      source: 'balance',
      amount: Math.round(params.amount * 100),
      recipient: recipientData.data.recipient_code,
      reason: params.narration || 'LightPay Transfer',
      reference: params.reference,
    });

    return {
      transferCode: transferData.data.transfer_code,
      reference: params.reference,
      status: transferData.data.status,
    };
  }

  async createDedicatedAccount(params: {
    userId: string;
    accountName: string;
  }): Promise<DedicatedAccountResult> {
    const { data } = await this.client.post('/dedicated_account', {
      customer: params.userId,
      preferred_bank: 'wema-bank',
    });

    return {
      accountNumber: data.data.account_number,
      bankName: data.data.bank.name,
      bankCode: data.data.bank.id.toString(),
      reference: data.data.id,
    };
  }

  private async getBankName(bankCode: string): Promise<string> {
    const banks = await this.getBankList();
    return banks.find((b) => b.code === bankCode)?.name ?? bankCode;
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    const crypto = await import('crypto');
    const hash = crypto
      .createHmac('sha512', this.config.get('app.paystackSecretKey') ?? process.env.PAYSTACK_SECRET_KEY ?? '')
      .update(payload)
      .digest('hex');
    return hash === signature;
  }
}
