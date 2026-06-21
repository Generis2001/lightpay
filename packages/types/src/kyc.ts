export type KycDocumentType = 'bvn' | 'nin' | 'passport' | 'drivers_license' | 'voters_card';
export type KycDocumentStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

export interface KycDocument {
  id: string;
  userId: string;
  type: KycDocumentType;
  documentNumber?: string;
  frontUrl?: string;
  backUrl?: string;
  selfieUrl?: string;
  status: KycDocumentStatus;
  rejectionReason?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface VerifyBvnRequest {
  bvn: string;
  dateOfBirth: string;
  firstName: string;
  lastName: string;
}

export interface BvnVerificationResult {
  verified: boolean;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
}

export interface KycLimits {
  tier: number;
  dailySendLimit: number;
  perTransactionLimit: number;
  balanceCap: number | null;
  features: string[];
}

export const KYC_TIER_LIMITS: Record<number, KycLimits> = {
  0: {
    tier: 0,
    dailySendLimit: 20_000,
    perTransactionLimit: 10_000,
    balanceCap: 100_000,
    features: ['naira_wallet'],
  },
  1: {
    tier: 1,
    dailySendLimit: 1_000_000,
    perTransactionLimit: 500_000,
    balanceCap: null,
    features: ['naira_wallet', 'qr_payments', 'beneficiaries'],
  },
  2: {
    tier: 2,
    dailySendLimit: 10_000_000,
    perTransactionLimit: 5_000_000,
    balanceCap: null,
    features: ['naira_wallet', 'qr_payments', 'beneficiaries', 'dollar_wallet', 'crypto_wallet', 'virtual_card'],
  },
};
