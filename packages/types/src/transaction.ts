export type TransactionType =
  | 'credit'
  | 'debit'
  | 'transfer_in'
  | 'transfer_out'
  | 'airtime'
  | 'data'
  | 'electricity'
  | 'cable'
  | 'water'
  | 'toll'
  | 'conversion'
  | 'crypto_buy'
  | 'crypto_sell';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';

export type TransactionChannel = 'app' | 'qr' | 'api' | 'ussd' | 'webhook';

export interface Transaction {
  id: string;
  reference: string;
  userId: string;
  walletId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  fee: string;
  balanceBefore: string;
  balanceAfter: string;
  currency: string;
  description: string | null;
  narration: string | null;
  metadata: Record<string, unknown>;
  channel: TransactionChannel;
  provider?: string;
  providerRef?: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TransactionWithDetails extends Transaction {
  recipientName?: string;
  recipientBank?: string;
  recipientAccount?: string;
  billToken?: string;
  units?: number;
}

export interface TransactionListItem {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  fee: string;
  currency: string;
  description: string | null;
  createdAt: string;
  isCredit: boolean;
}

export interface TransactionFilter {
  type?: TransactionType | 'all';
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Transfer requests
export interface BankTransferRequest {
  walletId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  narration?: string;
  saveBeneficiary?: boolean;
  pin: string;
}

export interface InternalTransferRequest {
  recipientPhone?: string;
  recipientUsername?: string;
  amount: number;
  narration?: string;
  pin: string;
}

// Bill payment requests
export interface AirtimeRequest {
  walletId: string;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  phone: string;
  amount: number;
  pin: string;
}

export interface DataRequest {
  walletId: string;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  phone: string;
  planCode: string;
  amount: number;
  pin: string;
}

export interface DataPlan {
  code: string;
  name: string;
  amount: number;
  validity: string;
  allowance: string;
}

export interface ElectricityRequest {
  walletId: string;
  provider: string;
  meterNumber: string;
  meterType: 'prepaid' | 'postpaid';
  amount: number;
  pin: string;
}

export interface CableRequest {
  walletId: string;
  provider: 'DSTV' | 'GOTV' | 'STARTIMES';
  smartcardNumber: string;
  planCode: string;
  amount: number;
  pin: string;
}

export interface CableSubscription {
  code: string;
  name: string;
  amount: number;
}

export interface TransactionReceipt {
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  fee: string;
  currency: string;
  description: string;
  createdAt: string;
  recipientName?: string;
  recipientBank?: string;
  recipientAccount?: string;
  billToken?: string;
  narration?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}
