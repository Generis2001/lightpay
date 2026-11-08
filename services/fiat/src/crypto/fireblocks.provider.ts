import { Injectable, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { Fireblocks, BasePath, TransactionRequest, TransactionResponse } from '@fireblocks/ts-sdk';

export const CRYPTO_NETWORKS = {
  BTC: { network: 'Bitcoin', assetId: 'BTC', decimals: 8 },
  ETH: { network: 'Ethereum', assetId: 'ETH', decimals: 18 },
  SOL: { network: 'Solana', assetId: 'SOL', decimals: 9 },
  BNB: { network: 'BNB Smart Chain', assetId: 'BNB_BSC', decimals: 18 },
} as const;
export type CryptoSymbol = keyof typeof CRYPTO_NETWORKS;

@Injectable()
export class FireblocksProvider {
  private client?: Fireblocks;
  configured() { return process.env.FIREBLOCKS_ENABLED === 'true' && !!process.env.FIREBLOCKS_API_KEY && !!process.env.FIREBLOCKS_SECRET_KEY; }
  private sdk() {
    if (!this.configured()) throw new ServiceUnavailableException('Crypto custody is not configured yet');
    if (!this.client) this.client = new Fireblocks({ apiKey: process.env.FIREBLOCKS_API_KEY!, secretKey: process.env.FIREBLOCKS_SECRET_KEY!.replace(/\\n/g, '\n'),
      basePath: process.env.FIREBLOCKS_BASE_PATH ?? BasePath.US, additionalOptions: { baseOptions: { timeout: 30000 } } });
    return this.client;
  }
  asset(symbol: string, network?: string) {
    if (!(Object.hasOwn(CRYPTO_NETWORKS, symbol))) throw new BadRequestException('Unsupported crypto asset');
    const asset = CRYPTO_NETWORKS[symbol as CryptoSymbol];
    if (network && network !== asset.network) throw new BadRequestException('Asset and network do not match');
    return { ...asset, assetId: process.env[`FIREBLOCKS_ASSET_${symbol}`] ?? asset.assetId };
  }
  async createVault(userId: string) {
    const { data } = await this.sdk().vaults.createVaultAccount({ createVaultAccountRequest: { name: `LightPay ${userId}`, customerRefId: userId, autoFuel: false }, idempotencyKey: userId });
    if (!data.id) throw new BadRequestException('Provider returned no vault account'); return data.id;
  }
  async address(vaultId: string, assetId: string, key: string) {
    try {
      const { data } = await this.sdk().vaults.getVaultAccountAssetAddressesPaginated({ vaultAccountId: vaultId, assetId, limit: 1 });
      if (data.addresses?.[0]?.address) return data.addresses[0];
    } catch (error: any) { if (error.response?.statusCode !== 404) throw error; }
    const { data } = await this.sdk().vaults.createVaultAccountAsset({ vaultAccountId: vaultId, assetId, idempotencyKey: key });
    if (!data.address) throw new BadRequestException('Provider has not activated a deposit address yet'); return data;
  }
  async validate(assetId: string, address: string, tag?: string | null) {
    const { data } = await this.sdk().transactions.validateAddress({ assetId, address });
    if (!data.isValid || (data.requiresTag && !tag)) throw new BadRequestException('Invalid address or missing destination tag');
  }
  request(vaultId: string, assetId: string, address: string, amount: string, tag?: string | null): TransactionRequest {
    return { assetId, source: { type: 'VAULT_ACCOUNT', id: vaultId }, destination: { type: 'ONE_TIME_ADDRESS', oneTimeAddress: { address, ...(tag ? { tag } : {}) } }, amount, treatAsGrossAmount: true, feeLevel: 'MEDIUM' };
  }
  async estimate(request: TransactionRequest) { return (await this.sdk().transactions.estimateTransactionFee({ transactionRequest: request })).data.medium.networkFee; }
  async send(request: TransactionRequest, reference: string) {
    return (await this.sdk().transactions.createTransaction({ transactionRequest: { ...request, externalTxId: reference, note: 'LightPay crypto transfer' }, idempotencyKey: reference.slice(0, 40) })).data;
  }
  async transaction(reference: string) { return (await this.sdk().transactions.getTransactionByExternalId({ externalTxId: reference })).data; }
  async completedDeposits(vaultId: string) {
    const results: TransactionResponse[] = []; const visited = new Set<string>(); let next: string | undefined;
    do {
      const page = await this.sdk().transactions.getTransactions({ destType: 'VAULT_ACCOUNT', destId: vaultId, status: 'COMPLETED', limit: 200, ...(next ? { next } : {}) });
      results.push(...page.data);
      const path = page.headers['next-page'];
      const cursor = path ? new URL(path, 'https://api.fireblocks.io').searchParams.get('next') : null;
      if (!cursor || visited.has(cursor)) break;
      visited.add(cursor); next = cursor;
    } while (next);
    return results;
  }
}
