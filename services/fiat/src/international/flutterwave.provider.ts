import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { Decimal } from 'decimal.js';

export const AFRICAN_CORRIDORS = [
  { country: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦' },
  { country: 'GH', name: 'Ghana', currency: 'GHS', symbol: 'GH₵' },
  { country: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
  { country: 'UG', name: 'Uganda', currency: 'UGX', symbol: 'USh' },
  { country: 'TZ', name: 'Tanzania', currency: 'TZS', symbol: 'TSh' },
  { country: 'RW', name: 'Rwanda', currency: 'RWF', symbol: 'FRw' },
  { country: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R' },
  { country: 'ZM', name: 'Zambia', currency: 'ZMW', symbol: 'K' },
];
@Injectable()
export class FlutterwaveProvider {
  configured() { return !!process.env.FLUTTERWAVE_SECRET_KEY && process.env.FLUTTERWAVE_ENABLED === 'true'; }
  corridors() {
    const enabled = (process.env.FLUTTERWAVE_ENABLED_COUNTRIES ?? '').split(',');
    return AFRICAN_CORRIDORS.map((corridor) => ({ ...corridor, enabled: this.configured() && enabled.includes(corridor.country) }));
  }
  corridor(country: string) {
    const corridor = this.corridors().find((c) => c.country === country);
    if (!corridor?.enabled) throw new ServiceUnavailableException('This bank corridor has not been activated with the provider');
    return corridor;
  }
  private client() {
    if (!this.configured()) throw new ServiceUnavailableException('African bank transfers are not configured');
    return axios.create({ baseURL: 'https://api.flutterwave.com/v3', timeout: 30000, headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } });
  }
  async banks(country: string) {
    this.corridor(country);
    const { data } = await this.client().get(`/banks/${country}`);
    if (data.status !== 'success' || !Array.isArray(data.data)) throw new BadRequestException('Unable to discover supported banks');
    return data.data as Array<{ id: number; code: string; name: string }>;
  }
  async branches(bankId: number) { const { data } = await this.client().get(`/banks/${bankId}/branches`); return data.data; }
  async rate(amount: string, destinationCurrency: string) {
    if (destinationCurrency === 'NGN') return { sourceAmount: amount, destinationAmount: amount };
    const { data } = await this.client().get('/transfers/rates', { params: { amount, source_currency: 'NGN', destination_currency: destinationCurrency } });
    const rate = data.data;
    if (data.status !== 'success' || rate?.source?.currency !== 'NGN' || rate?.destination?.currency !== destinationCurrency || !new Decimal(rate.source.amount).eq(amount)) {
      throw new BadRequestException('Provider could not confirm a quote for the requested NGN amount');
    }
    return { sourceAmount: String(rate.source.amount), destinationAmount: String(rate.destination.amount) };
  }
  async fee(amount: string) {
    const { data } = await this.client().get('/transfers/fee', { params: { currency: 'NGN', amount } });
    const fee = Array.isArray(data.data) ? data.data.find((item: any) => item.currency === 'NGN' && (!item.type || item.type === 'bank')) : data.data;
    if (data.status !== 'success' || fee?.fee === undefined || (fee.currency && fee.currency !== 'NGN') || !new Decimal(fee.fee).isFinite() || new Decimal(fee.fee).lt(0)) throw new BadRequestException('Unable to confirm transfer fees');
    return String(fee.fee);
  }
  async send(params: Record<string, unknown>) {
    const { data } = await this.client().post('/transfers', params);
    if (data.status !== 'success' || !data.data?.id) throw new BadRequestException('Provider has not confirmed transfer submission');
    return data.data;
  }
  async transfer(id: string) { const { data } = await this.client().get(`/transfers/${encodeURIComponent(id)}`); if (data.status !== 'success') throw new BadRequestException('Unable to verify transfer'); return data.data; }
  async byReference(reference: string) {
    const { data } = await this.client().get('/transfers', { params: { reference } });
    if (data.status !== 'success' || !Array.isArray(data.data)) throw new BadRequestException('Unable to verify transfer reference');
    return data.data.find((tx: any) => tx.reference === reference);
  }
}
