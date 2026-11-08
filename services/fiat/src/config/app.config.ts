import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('Set a shared JWT_SECRET of at least 32 characters before production startup');
  return ({
  port: parseInt(process.env.FIAT_PORT ?? '3002', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  isProduction: process.env.NODE_ENV === 'production',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
  vtpassApiKey: process.env.VTPASS_API_KEY ?? '',
  vtpassPublicKey: process.env.VTPASS_PUBLIC_KEY ?? '',
  vtpassSecretKey: process.env.VTPASS_SECRET_KEY ?? '',
});
});
