import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';

export interface ResolvedAccount {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface Bank {
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
  accountName: string;
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
    this.assertConfigured();
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

  assertConfigured() {
    if (!(this.config.get<string>('app.paystackSecretKey') || process.env.PAYSTACK_SECRET_KEY)) {
      throw new ServiceUnavailableException('Payment provider is not configured');
    }
  }

  async getOrCreateCustomer(profile: { email: string; firstName: string; lastName: string; phone?: string | null }) {
    this.assertConfigured();
    try {
      const { data } = await this.client.get(`/customer/${encodeURIComponent(profile.email)}`);
      return { id: String(data.data.id), code: String(data.data.customer_code) };
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
    }
    const { data } = await this.client.post('/customer', {
      email: profile.email, first_name: profile.firstName, last_name: profile.lastName, phone: profile.phone,
    });
    return { id: String(data.data.id), code: String(data.data.customer_code) };
  }

  async createDedicatedAccount(params: { customerId: string; customerCode: string }): Promise<DedicatedAccountResult> {
    this.assertConfigured();
    const { data: accounts } = await this.client.get('/dedicated_account', {
      params: { customer: params.customerId, active: true, currency: 'NGN' },
    });
    let account = accounts.data?.find((a: any) => String(a.customer?.id) === params.customerId && a.active && a.currency === 'NGN');
    if (!account) {
      const { data } = await this.client.post('/dedicated_account', {
        customer: params.customerCode, preferred_bank: process.env.PAYSTACK_DEDICATED_BANK ?? 'wema-bank',
      });
      account = data.data;
    }
    const { data: banks } = await this.client.get('/bank', { params: { country: 'nigeria', perPage: 100 } });
    const bank = banks.data.find((b: any) => b.slug === account.bank?.slug || b.id === account.bank?.id);
    if (!bank?.code || !/^\d{10}$/.test(account.account_number)) throw new BadRequestException('Provider returned incomplete receiving-account details');
    return { accountNumber: account.account_number, accountName: account.account_name,
      bankName: account.bank.name, bankCode: bank.code, reference: String(account.id) };
  }

  async initializePayment(params: { email: string; amount: number; reference: string; userId: string }) {
    this.assertConfigured();
    const { data } = await this.client.post('/transaction/initialize', {
      email: params.email, amount: Math.round(params.amount * 100), currency: 'NGN', channels: ['card'],
      reference: params.reference, metadata: { lightpayUserId: params.userId },
      ...(process.env.PAYSTACK_CALLBACK_URL ? { callback_url: process.env.PAYSTACK_CALLBACK_URL } : {}),
    });
    if (!data.status || !data.data?.authorization_url) throw new BadRequestException('Unable to initialize payment');
    return data.data as { authorization_url: string; reference: string; access_code: string };
  }

  async verifyPayment(reference: string) {
    this.assertConfigured();
    const { data } = await this.client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (!data.status) throw new BadRequestException('Unable to verify payment');
    return data.data;
  }

  async verifyTransfer(reference: string) {
    this.assertConfigured();
    const { data } = await this.client.get(`/transfer/verify/${encodeURIComponent(reference)}`);
    if (!data.status) throw new BadRequestException('Unable to verify transfer');
    return data.data;
  }

  private async getBankName(bankCode: string): Promise<string> {
    const banks = await this.getBankList();
    return banks.find((b) => b.code === bankCode)?.name ?? bankCode;
  }

  async verifyWebhook(payload: Buffer | string, signature: string): Promise<boolean> {
    const secret = this.config.get<string>('app.paystackSecretKey') || process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !/^[a-fA-F0-9]{128}$/.test(signature)) return false;
    const hash = createHmac('sha512', secret).update(payload).digest();
    return timingSafeEqual(hash, Buffer.from(signature, 'hex'));
  }
}
