import { Injectable, BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { WalletsService } from '../wallets/wallets.service';
import { Transaction } from '../transactions/transaction.entity';
import { requestFingerprint } from '../common/utils';

/** VTpass serviceID mappings (https://vtpass.com/documentation) */
const AIRTIME_SERVICE_ID: Record<string, string> = {
  MTN: 'mtn',
  GLO: 'glo',
  AIRTEL: 'airtel',
  '9MOBILE': 'etisalat',
};

const DATA_SERVICE_ID: Record<string, string> = {
  MTN: 'mtn-data',
  GLO: 'glo-data',
  AIRTEL: 'airtel-data',
  '9MOBILE': 'etisalat-data',
};

/** DISCO id -> VTpass electricity serviceID */
const ELECTRICITY_SERVICE_ID: Record<string, string> = {
  IKEDC: 'ikeja-electric',
  EKEDC: 'eko-electric',
  KEDCO: 'kano-electric',
  PHED: 'portharcourt-electric',
  JED: 'jos-electric',
  IBEDC: 'ibadan-electric',
  KAEDCO: 'kaduna-electric',
  AEDC: 'abuja-electric',
  EEDC: 'enugu-electric',
  BEDC: 'benin-electric',
};

const CABLE_SERVICE_ID: Record<string, string> = {
  DSTV: 'dstv',
  GOTV: 'gotv',
  STARTIMES: 'startimes',
};

@Injectable()
export class BillsService {
  private readonly client: AxiosInstance;

  constructor(
    private readonly config: ConfigService,
    private readonly walletsService: WalletsService,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {
    // Non-production uses VTpass sandbox (real API, free). Production uses live.
    this.client = axios.create({
      baseURL:
        process.env.NODE_ENV === 'production'
          ? 'https://vtpass.com/api'
          : 'https://sandbox.vtpass.com/api',
      headers: {
        'api-key': this.config.get('app.vtpassApiKey') ?? '',
        'secret-key': this.config.get('app.vtpassSecretKey') ?? '',
        'public-key': this.config.get('app.vtpassPublicKey') ?? '',
      },
      timeout: 30000,
    });
  }

  // ─────────────────────────── AIRTIME ───────────────────────────

  async getAirtimeNetworks() {
    return [
      { id: 'MTN', name: 'MTN', logo: 'mtn' },
      { id: 'GLO', name: 'GLO', logo: 'glo' },
      { id: 'AIRTEL', name: 'Airtel', logo: 'airtel' },
      { id: '9MOBILE', name: '9mobile', logo: '9mobile' },
    ];
  }

  async purchaseAirtime(params: {
    userId: string;
    idempotencyKey: string;
    walletId: string;
    network: string;
    phone: string;
    amount: number;
  }) {
    this.assertConfigured();
    const serviceID = AIRTIME_SERVICE_ID[params.network];
    if (!serviceID) throw new BadRequestException('Unsupported network');

    const { idempotencyKey, ...draft } = params;
    const fingerprint = requestFingerprint({ kind: 'AIR', ...draft });
    const reference = await this.walletsService.paymentReference(params.userId, idempotencyKey, fingerprint, 'AIR', true);
    const providerRequest = {
      serviceID,
      billersCode: params.phone,
      amount: params.amount,
      phone: params.phone,
      request_id: reference,
    };
    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: params.amount,
      type: 'airtime',
      description: `₦${params.amount} ${params.network} Airtime to ${params.phone}`,
      reference, metadata: { providerRequest },
      status: 'processing', provider: 'vtpass', requestFingerprint: fingerprint,
    });



    if (!(await this.walletsService.claimProviderRequest(tx.id))) {
      const current = await this.txRepo.findOne({ where: { id: tx.id } });
      return { transaction: current, status: current?.status ?? 'processing' };
    }
    const result = await this.vtpassPay(providerRequest);

    return this.finalizeBillTx(tx.id, params.userId, result);
  }

  // ───────────────────────────── DATA ────────────────────────────

  async getDataPlans(network: string) {
    const serviceID = DATA_SERVICE_ID[network];
    if (!serviceID) return [];

    const variations = await this.fetchVariations(serviceID);
    return variations.map((v) => ({
      code: v.variation_code,
      name: v.name,
      amount: parseFloat(v.variation_amount),
      validity: v.name,
      allowance: v.name,
    }));
  }

  async purchaseData(params: {
    userId: string;
    idempotencyKey: string;
    walletId: string;
    network: string;
    phone: string;
    planCode: string;
    amount: number;
  }) {
    this.assertConfigured();
    const serviceID = DATA_SERVICE_ID[params.network];
    if (!serviceID) throw new BadRequestException('Unsupported network');

    const plans = await this.getDataPlans(params.network);
    const plan = plans.find((p) => p.code === params.planCode);
    if (!plan) throw new BadRequestException('Invalid data plan');
    if (plan.amount !== params.amount) throw new ConflictException('Plan price changed. Refresh the plans and review the payment again.');

    const { idempotencyKey, ...draft } = params;
    const fingerprint = requestFingerprint({ kind: 'DATA', ...draft });
    const reference = await this.walletsService.paymentReference(params.userId, idempotencyKey, fingerprint, 'DATA', true);
    const providerRequest = {
      serviceID,
      billersCode: params.phone,
      variation_code: params.planCode,
      amount: plan.amount,
      phone: params.phone,
      request_id: reference,
    };
    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: plan.amount,
      type: 'data',
      description: `${plan.allowance} ${params.network} Data to ${params.phone}`,
      reference, metadata: { providerRequest },
      status: 'processing', provider: 'vtpass', requestFingerprint: fingerprint,
    });



    if (!(await this.walletsService.claimProviderRequest(tx.id))) {
      const current = await this.txRepo.findOne({ where: { id: tx.id } });
      return { transaction: current, status: current?.status ?? 'processing' };
    }
    const result = await this.vtpassPay(providerRequest);

    return this.finalizeBillTx(tx.id, params.userId, result);
  }

  // ────────────────────────── ELECTRICITY ────────────────────────

  async verifyMeter(params: { provider: string; meterNumber: string; meterType: string }) {
    const serviceID = ELECTRICITY_SERVICE_ID[params.provider];
    if (!serviceID) throw new BadRequestException('Unsupported electricity provider');

    const verify = await this.vtpassVerify(serviceID, params.meterNumber, params.meterType);
    return {
      customerName: verify.Customer_Name ?? verify.customerName ?? '',
      address: verify.Address ?? verify.address ?? '',
      meterNumber: params.meterNumber,
      provider: params.provider,
    };
  }

  async payElectricity(params: {
    userId: string;
    idempotencyKey: string;
    walletId: string;
    provider: string;
    meterNumber: string;
    meterType: string;
    amount: number;
  }) {
    this.assertConfigured();
    const serviceID = ELECTRICITY_SERVICE_ID[params.provider];
    if (!serviceID) throw new BadRequestException('Unsupported electricity provider');

    const { idempotencyKey, ...draft } = params;
    const fingerprint = requestFingerprint({ kind: 'ELEC', ...draft });
    const reference = await this.walletsService.paymentReference(params.userId, idempotencyKey, fingerprint, 'ELEC', true);
    const providerRequest = {
      serviceID,
      billersCode: params.meterNumber,
      variation_code: params.meterType, // 'prepaid' | 'postpaid'
      amount: params.amount,
      phone: params.meterNumber,
      request_id: reference,
    };
    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: params.amount,
      type: 'electricity',
      description: `₦${params.amount} ${params.provider} Electricity - ${params.meterNumber}`,
      reference,
      status: 'processing', provider: 'vtpass', requestFingerprint: fingerprint,
      metadata: { providerRequest,
        meterNumber: params.meterNumber,
        meterType: params.meterType,
        provider: params.provider,
      },
    });



    if (!(await this.walletsService.claimProviderRequest(tx.id))) {
      const current = await this.txRepo.findOne({ where: { id: tx.id } });
      return { transaction: current, status: current?.status ?? 'processing' };
    }
    const result = await this.vtpassPay(providerRequest);

    const finalized = await this.finalizeBillTx(tx.id, params.userId, result);
    return {
      ...finalized,
      token: result.token ?? null,
      units: result.units ?? null,
    };
  }

  // ───────────────────────────── CABLE ───────────────────────────

  async getCablePlans(provider: string) {
    const serviceID = CABLE_SERVICE_ID[provider];
    if (!serviceID) return [];

    const variations = await this.fetchVariations(serviceID);
    return variations.map((v) => ({
      code: v.variation_code,
      name: v.name,
      amount: parseFloat(v.variation_amount),
    }));
  }

  async verifySmartCard(params: { provider: string; smartCardNumber: string }) {
    const serviceID = CABLE_SERVICE_ID[params.provider];
    if (!serviceID) throw new BadRequestException('Unsupported cable provider');

    const verify = await this.vtpassVerify(serviceID, params.smartCardNumber);
    return {
      customerName: verify.Customer_Name ?? verify.customerName ?? '',
      smartCardNumber: params.smartCardNumber,
      provider: params.provider,
    };
  }

  async payCable(params: {
    userId: string;
    idempotencyKey: string;
    walletId: string;
    provider: string;
    smartcardNumber: string;
    planCode: string;
    amount: number;
  }) {
    this.assertConfigured();
    const serviceID = CABLE_SERVICE_ID[params.provider];
    if (!serviceID) throw new BadRequestException('Unsupported cable provider');

    const plans = await this.getCablePlans(params.provider);
    const plan = plans.find((p) => p.code === params.planCode);
    if (!plan) throw new BadRequestException('Invalid cable plan');
    if (plan.amount !== params.amount) throw new ConflictException('Plan price changed. Refresh the plans and review the payment again.');

    const { idempotencyKey, ...draft } = params;
    const fingerprint = requestFingerprint({ kind: 'CABLE', ...draft });
    const reference = await this.walletsService.paymentReference(params.userId, idempotencyKey, fingerprint, 'CABLE', true);
    const providerRequest = {
      serviceID,
      billersCode: params.smartcardNumber,
      variation_code: params.planCode,
      amount: plan.amount,
      phone: params.smartcardNumber,
      request_id: reference,
    };
    const tx = await this.walletsService.debitWallet({
      walletId: params.walletId,
      userId: params.userId,
      amount: plan.amount,
      type: 'cable',
      description: `${plan.name} - ${params.provider} (${params.smartcardNumber})`,
      reference, metadata: { providerRequest },
      status: 'processing', provider: 'vtpass', requestFingerprint: fingerprint,
    });



    if (!(await this.walletsService.claimProviderRequest(tx.id))) {
      const current = await this.txRepo.findOne({ where: { id: tx.id } });
      return { transaction: current, status: current?.status ?? 'processing' };
    }
    const result = await this.vtpassPay(providerRequest);

    return this.finalizeBillTx(tx.id, params.userId, result);
  }

  // ─────────────────────── VTpass primitives ─────────────────────

  private assertConfigured() {
    if (!this.config.get('app.vtpassApiKey') || !this.config.get('app.vtpassSecretKey')) throw new ServiceUnavailableException('Bill payment provider is not configured');
  }

  private async finalizeBillTx(txId: string, userId: string, result: VtpassResult) {
    const metadata = { ...(result.token ? { token: result.token } : {}), ...(result.units ? { units: result.units } : {}) };
    if (result.status === 'completed' || result.status === 'failed') {
      const transaction = await this.walletsService.settleOutgoing(txId, result.status, result.providerRef, metadata);
      return { transaction, providerRef: result.providerRef, status: transaction.status };
    }
    await this.txRepo.update(txId, { providerStatus: 'processing', providerRef: result.providerRef ?? null });
    return { transaction: await this.txRepo.findOne({ where: { id: txId } }), status: 'processing' };
  }

  private parseResult(data: any): VtpassResult {
    const purchased = data.content?.transactions ?? {};
    const status = String(purchased.status ?? '').toLowerCase();
    // Pending/unknown responses remain debited until a provider query confirms the result.
    const result: VtpassResult = {
      status: data.code === '000' && status === 'delivered' ? 'completed' : ['failed', 'reversed'].includes(status) ? 'failed' : 'processing',
      providerRef: purchased.transactionId ?? data.requestId,
      message: data.response_description,
    };
    const token = data.Token ?? data.token ?? purchased.token;
    if (token) result.token = String(token);
    const units = Number.parseFloat(data.units ?? purchased.units);
    if (Number.isFinite(units)) result.units = units;
    return result;
  }

  private async vtpassPay(params: Record<string, unknown>): Promise<VtpassResult> {
    try { const { data } = await this.client.post('/pay', params); return this.parseResult(data); }
    catch { return { status: 'processing', message: 'Awaiting provider confirmation' }; }
  }

  async reconcile(tx: Transaction) {
    this.assertConfigured();
    if (!tx.metadata.providerAttemptedAt && await this.walletsService.claimProviderRequest(tx.id)) {
      const request = tx.metadata.providerRequest as Record<string, unknown>;
      if (request) return this.finalizeBillTx(tx.id, tx.userId, await this.vtpassPay(request));
    }
    const { data } = await this.client.post('/requery', { request_id: tx.reference });
    return this.finalizeBillTx(tx.id, tx.userId, this.parseResult(data));
  }

  private async vtpassVerify(
    serviceID: string,
    billersCode: string,
    type?: string,
  ): Promise<Record<string, string>> {
    try {
      const { data } = await this.client.post('/merchant-verify', {
        serviceID,
        billersCode,
        type,
      });
      const content = data.content ?? {};
      if (content.error || data.code !== '000') {
        throw new BadRequestException(content.error ?? 'Verification failed');
      }
      return content;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Unable to verify with provider');
    }
  }

  private async fetchVariations(serviceID: string): Promise<VtpassVariation[]> {
    try {
      const { data } = await this.client.get('/service-variations', {
        params: { serviceID },
      });
      return data.content?.variations ?? data.content?.varations ?? [];
    } catch {
      throw new ServiceUnavailableException("Unable to load provider plans. Please try again.");
    }
  }
}

interface VtpassResult {
  status: 'completed' | 'failed' | 'processing';
  providerRef?: string;
  message?: string;
  token?: string;
  units?: number;
}

interface VtpassVariation {
  variation_code: string;
  name: string;
  variation_amount: string;
}
