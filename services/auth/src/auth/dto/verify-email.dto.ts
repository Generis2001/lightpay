import { IsEmail, Matches } from 'class-validator';
export class RequestEmailVerificationDto { @IsEmail() email!: string; }
export class VerifyEmailDto extends RequestEmailVerificationDto { @Matches(/^\d{6}$/) code!: string; }
