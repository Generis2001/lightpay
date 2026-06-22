import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WalletsService } from '../wallets/wallets.service';
import { Transaction } from '../transactions/transaction.entity';
import { generateReference } from '../common/utils';

@Injectable()
export class BillsService {
  private readonly vtpassBaseUrl = 'https://sandbox.vtpass.com/api';

  constructor(
    private readonly config: ConfigService,
    private readonly walletsService: WalletsService,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  async getAirtimeNetworks() {
    return [
      { id: 'MTN', name: 'MTN', logo: 'mtn' },
      { id: 'GLO', name: 'GLO', logo: 'glo' },
      { id: 'AIRTEL', name: 'Airtel', logo: 'airtel' },
      { id: '9MOBILE', name: '9mobile', logo: '9mobile' },
    ];
  }

  async getDataPlans(network: string) {
    const plans: Record<string, { code: string; name: string; amount: number; validity: string; allowance: string }[]> = {
      MTN: [
        { code: 'mtn-500mb-1day', name: '500MB', amount: 150, validity: '1 Day', allowance: '500MB' },
        { code: 'mtn-1gb-1day', name: '1GB', amount: 300, validity: '1 Day', allowance: '1GB' },
        { code: 'mtn-2gb-3days', name: '2GB', amount: 500, validity: '3 Days', allowance: '2GB' },
        { code: 'mtn-3gb-7days', name: '3GB', amount: 1000, validity: '7 Days', allowance: '3GB' },
        { code: 'mtn-5gb-30days', name: '5GB', amount: 1500, validity: '30 Days', allowance: '5GB' },
        { code: 'mtn-10gb-30days', name: '10GB', amount: 2500, validity: '30 Days', allowance: '10GB' },
        { code: 'mtn-20gb-30days', name: '20GB', amount: 4500, validity: '30 Days', allowance: '20GB' },
      ],
      GLO: [
        { code: 'glo-1gb-1day', name: '1GB', amount: 200, validity: '1 Day', allowance: '1GB' },
        { code: 'glo-2gb-3days', name: '2GB', amount: 500, validity: '3 Days', allowance: '2GB' },
        { code: 'glo-5gb-30days', name: '5GB', amount: 1500, validity: '30 Days', allowance: '5GB' },
        { code: 'glo-10gb-30days', name: '10GB', amount: 2500, validity: '30 Days', allowance: '10GB' },
      ],
      AIRTEL: [
        { code: 'airtel-500mb-1day', name: '500MB', amount: 150, validity: '1 Day', allowance: '500MB' },
        { code: 'airtel-2gb-3days', name: '2GB', amount: 500, validity: '3 Days', allowance: '2GB' },
        { code: 'airtel-6gb-30days', name: '6GB', amount: 1500, validity: '30 Days', allowance: '6GB' },
      ],
      '9MOBILE': [
        { code: '9mobile-1gb-1day', name: '1GB', amount: 200, validity: '1 Day', allowance: '1GB' },
        { code: '9mobile-2gb-30days', name: '2GB', amount: 1000, validity: '30 Days', allowance: '2GB' },
      ],
    };

    return plans[network] ?? [];
  }

  async purchaseAirtime(params: {
    userId: string;
    walletId: string;
    network: string;
    phone: string;
    amount: number;
  }) {
    const reference = generateReference('AIR');

    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: params.amount,
      type: 'airtime',
      description: `₦${params.amount} ${params.network} Airtime to ${params.phone}`,
      reference,
      status: 'processing',
    });

    // Call VTPass / BillsAfrica API
    const result = await this.callAirtimeProvider({
      network: params.network,
      phone: params.phone,
      amount: params.amount,
      reference,
    });

    if (result.success) {
      await this.txRepo.update(tx.id, {
        status: 'completed',
        providerRef: result.requestId,
        completedAt: new Date(),
      });
      return { transaction: { ...tx, status: 'completed' }, providerRef: result.requestId, status: 'completed' };
    } else {
      await this.walletsService.reverseTransaction(tx.id, params.userId);
      throw new BadRequestException({
        code: 'PROVIDER_ERROR',
        message: result.message || 'Airtime purchase failed',
      });
    }
  }

  async purchaseData(params: {
    userId: string;
    walletId: string;
    network: string;
    phone: string;
    planCode: string;
    amount: number;
  }) {
    const reference = generateReference('DATA');
    const plans = await this.getDataPlans(params.network);
    const plan = plans.find((p) => p.code === params.planCode);
    if (!plan) throw new BadRequestException('Invalid data plan');

    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: plan.amount,
      type: 'data',
      description: `${plan.allowance} ${params.network} Data to ${params.phone}`,
      reference,
      status: 'processing',
    });

    return { transaction: tx, status: 'processing', message: 'Data purchase initiated' };
  }

  async verifyMeter(params: { provider: string; meterNumber: string; meterType: string }) {
    if (process.env.NODE_ENV === 'development') {
      return {
        customerName: 'JOHN DOE',
        address: '12 Victoria Island, Lagos',
        meterNumber: params.meterNumber,
        provider: params.provider,
      };
    }
    // Call VTPass meter verification
    return null;
  }

  async payElectricity(params: {
    userId: string;
    walletId: string;
    provider: string;
    meterNumber: string;
    meterType: string;
    amount: number;
  }) {
    const reference = generateReference('ELEC');

    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: params.amount,
      type: 'electricity',
      description: `₦${params.amount} ${params.provider} Electricity - ${params.meterNumber}`,
      reference,
      status: 'processing',
      metadata: {
        meterNumber: params.meterNumber,
        meterType: params.meterType,
        provider: params.provider,
      },
    });

    // Dev mode returns mock token
    const token = process.env.NODE_ENV === 'development'
      ? `${Math.floor(Math.random() * 9999)}-${Math.floor(Math.random() * 9999)}-${Math.floor(Math.random() * 9999)}-${Math.floor(Math.random() * 9999)}`
      : null;

    return {
      transaction: tx,
      token,
      status: 'completed',
      units: params.amount / 50, // Mock unit calculation
    };
  }

  async getCablePlans(provider: string) {
    const plans: Record<string, { code: string; name: string; amount: number }[]> = {
      DSTV: [
        { code: 'dstv-padi', name: 'DStv Padi', amount: 2950 },
        { code: 'dstv-yanga', name: 'DStv Yanga', amount: 4100 },
        { code: 'dstv-confam', name: 'DStv Confam', amount: 6200 },
        { code: 'dstv-compact', name: 'DStv Compact', amount: 10500 },
        { code: 'dstv-compact-plus', name: 'DStv Compact Plus', amount: 16600 },
        { code: 'dstv-premium', name: 'DStv Premium', amount: 24500 },
      ],
      GOTV: [
        { code: 'gotv-lite', name: 'GOtv Lite', amount: 900 },
        { code: 'gotv-jinja', name: 'GOtv Jinja', amount: 2715 },
        { code: 'gotv-jolli', name: 'GOtv Jolli', amount: 3800 },
        { code: 'gotv-max', name: 'GOtv Max', amount: 5500 },
      ],
    };

    return plans[provider] ?? [];
  }

  async payCable(params: {
    userId: string;
    walletId: string;
    provider: string;
    smartcardNumber: string;
    planCode: string;
    amount: number;
  }) {
    const plans = await this.getCablePlans(params.provider);
    const plan = plans.find((p) => p.code === params.planCode);
    if (!plan) throw new BadRequestException('Invalid cable plan');

    const reference = generateReference('CABLE');

    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: plan.amount,
      type: 'cable',
      description: `${plan.name} - ${params.provider} (${params.smartcardNumber})`,
      reference,
      status: 'completed',
    });

    return { transaction: tx, status: 'completed' };
  }

  private async callAirtimeProvider(params: {
    network: string;
    phone: string;
    amount: number;
    reference: string;
  }): Promise<{ success: boolean; requestId?: string; message?: string }> {
    if (process.env.NODE_ENV === 'development') {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, requestId: `VTP_${Date.now()}` };
    }

    try {
      const serviceIdMap: Record<string, string> = {
        MTN: 'mtn',
        GLO: 'glo',
        AIRTEL: 'airtel',
        '9MOBILE': 'etisalat',
      };

      const response = await axios.post(
        `${this.vtpassBaseUrl}/pay`,
        {
          request_id: params.reference,
          serviceID: serviceIdMap[params.network],
          amount: params.amount,
          phone: params.phone,
        },
        {
          headers: {
            'api-key': this.config.get('fiat.vtpassApiKey'),
            'public-key': this.config.get('fiat.vtpassPublicKey'),
          },
        },
      );

      return {
        success: response.data.code === '000',
        requestId: response.data.requestId,
        message: response.data.response_description,
      };
    } catch {
      return { success: false, message: 'Provider error' };
    }
  }
}
