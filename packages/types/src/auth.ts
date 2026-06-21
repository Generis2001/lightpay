export type AuthMethod = 'phone' | 'email';
export type OtpPurpose = 'registration' | 'login' | 'transaction' | 'reset_pin' | 'kyc';

export interface RegisterPhoneRequest {
  phone: string;
  referralCode?: string;
}

export interface RegisterEmailRequest {
  email: string;
  referralCode?: string;
}

export interface VerifyOtpRequest {
  identifier: string; // phone or email
  method: AuthMethod;
  code: string;
  purpose: OtpPurpose;
}

export interface SetPinRequest {
  pin: string;
  confirmPin: string;
}

export interface LoginRequest {
  identifier: string; // phone or email
  method: AuthMethod;
}

export interface LoginPinRequest {
  userId: string;
  pin: string;
  deviceId: string;
  deviceName?: string;
  platform: 'ios' | 'android';
  pushToken?: string;
}

export interface BiometricLoginRequest {
  userId: string;
  biometricSignature: string;
  deviceId: string;
  challenge: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    kycTier: number;
    hasPin: boolean;
    hasBiometric: boolean;
  };
  tokens: AuthTokens;
  isNewUser: boolean;
}

export interface RegisterBiometricRequest {
  biometricPublicKey: string;
  deviceId: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePhoneRequest {
  newPhone: string;
  otp: string;
  pin: string;
}

export interface ChangePinRequest {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android';
  osVersion: string;
  appVersion: string;
  pushToken?: string;
}
