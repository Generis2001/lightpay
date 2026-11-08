import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

export function identityDate(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('Provider returned no birth date');
  let iso = value;
  const numeric = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (numeric) iso = `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  if (named) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const month = months.indexOf(named[2]!.toLowerCase()) + 1;
    iso = `${named[3]}-${String(month).padStart(2,'0')}-${named[1]!.padStart(2,'0')}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(iso)) || new Date(iso).toISOString().slice(0,10) !== iso) throw new BadRequestException('Invalid birth date');
  return iso;
}
export function confirmedFace(face: any) {
  return face?.status === true && face.response_code === '00' && /^(?:face|fatch)\s+match(?:ed)?$/i.test(String(face.message).trim());
}
export function confirmedLiveness(response: any) {
  const confidence = Number(response?.data?.confidence);
  return response?.status === true && response.response_code === '00' && Number.isFinite(confidence) && confidence >= 0.95 && confidence <= 1;
}
@Injectable()
export class PremblyProvider {
  configured() {
    return process.env.PREMBLY_ENABLED === 'true' && process.env.PREMBLY_ENVIRONMENT === 'live' && !!process.env.PREMBLY_API_KEY && !!process.env.PREMBLY_API_BASE_URL && (process.env.PREMBLY_IDENTITY_HASH_KEY?.length ?? 0) >= 32;
  }
  private client() {
    if (!this.configured()) throw new ServiceUnavailableException('Identity verification is not activated yet');
    const baseURL = process.env.PREMBLY_API_BASE_URL!;
    if (!baseURL.startsWith('https://')) throw new ServiceUnavailableException('Identity provider requires HTTPS');
    return axios.create({ baseURL, timeout: 60000, headers: { 'x-api-key': process.env.PREMBLY_API_KEY, 'app-id': process.env.PREMBLY_APP_ID ?? '' } });
  }
  async verify(type: 'bvn' | 'nin', number: string, image: string) {
    const client = this.client();
    const legacy = process.env.PREMBLY_API_FORMAT === 'legacy_v2';
    const verificationPath = legacy ? type === 'bvn' ? 'data/verification/bvn_w_face' : 'data/verification/nin' : `${type}_w_face/`;
    const livenessPath = legacy ? 'face/liveliness_check' : 'liveliness_check/';
    const [identity, liveness] = await Promise.all([
      client.post(verificationPath, { number, image }), client.post(livenessPath, { image }),
    ]);
    const response = identity.data;
    const record = type === 'nin' ? response.data?.nin_data ?? response.nin_data : response.data ?? response.bvn_data;
    const face = record?.face_data ?? response.data?.face_data ?? response.face_data;
    if (response.status !== true || response.response_code !== '00' || !confirmedFace(face) || !confirmedLiveness(liveness.data)) {
      throw new BadRequestException('Identity or selfie could not be verified. Check your details and take a clear live selfie.');
    }
    const returnedNumber = String(record?.[type] ?? '').padStart(11, '0');
    if (returnedNumber !== number) throw new BadRequestException('Provider identity number mismatch');
    const firstName = record.firstName ?? record.firstname ?? record.first_name;
    const lastName = record.lastName ?? record.surname ?? record.last_name;
    if (typeof firstName !== 'string' || typeof lastName !== 'string') throw new BadRequestException('Provider returned incomplete identity details');
    return { firstName, lastName, dateOfBirth: identityDate(record.dateOfBirth ?? record.birthdate ?? record.date_of_birth),
      reference: String(record.verification?.verification_id ?? response.verification?.verification_id ?? record.billing_info?.reference_id ?? ''), faceMatched: true, livenessConfirmed: true };
  }
}
