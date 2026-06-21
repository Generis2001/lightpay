export type WalletType = 'naira' | 'dollar' | 'crypto';
export type Currency = 'NGN' | 'USD' | 'BTC' | 'ETH' | 'SOL' | 'BNB';

export interface Wallet {
  id: string;
  userId: string;
  type: WalletType;
  currency: Currency;
  balance: number;
  ledgerBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualAccount {
  id: string;
  userId: string;
  walletId: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  accountName: string;
  provider: string;
  isActive: boolean;
}

export interface WalletWithAccount extends Wallet {
  virtualAccount: VirtualAccount | null;
}

export interface BankAccount {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface ResolvedBankAccount {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface Bank {
  code: string;
  name: string;
  logo?: string;
  ussdCode?: string;
}

export interface Beneficiary {
  id: string;
  userId: string;
  type: 'bank' | 'lightpay' | 'airtime' | 'bill';
  name: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  phone?: string;
  lightpayUserId?: string;
  billCategory?: string;
  billProvider?: string;
  billReference?: string;
  lastAmount?: number;
  timesUsed: number;
  isFavourite: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface QrPayload {
  version: string;
  type: 'receive' | 'pay';
  userId: string;
  accountName: string;
  amount?: number;
  description?: string;
  reference?: string;
  expiresAt?: string;
}
