import { Matches } from 'class-validator';
export class RequestPhoneVerificationDto { @Matches(/^\+234[789]\d{9}$/) phone!: string; }
export class VerifyPhoneDto extends RequestPhoneVerificationDto { @Matches(/^\d{6}$/) code!: string; }
