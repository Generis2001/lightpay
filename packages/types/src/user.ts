export type KycTier = 0 | 1 | 2;
export type KycStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface User {
  id: string;
  phone: string | null;
  phoneVerified: boolean;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  kycTier: KycTier;
  kycStatus: KycStatus;
  referralCode: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserProfile extends User {
  wallets: WalletSummary[];
  totalBalance: number;
}

export interface WalletSummary {
  id: string;
  currency: string;
  balance: number;
  type: 'naira' | 'dollar' | 'crypto';
}
