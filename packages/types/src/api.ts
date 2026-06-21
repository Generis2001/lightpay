export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  timestamp: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// Common error codes
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  TRANSACTION_LIMIT_EXCEEDED: 'TRANSACTION_LIMIT_EXCEEDED',
  INVALID_PIN: 'INVALID_PIN',
  PIN_LOCKED: 'PIN_LOCKED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PHONE_TAKEN: 'PHONE_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  KYC_REQUIRED: 'KYC_REQUIRED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  BANK_RESOLVE_FAILED: 'BANK_RESOLVE_FAILED',
  TRANSFER_FAILED: 'TRANSFER_FAILED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
