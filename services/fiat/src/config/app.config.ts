import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.FIAT_PORT ?? '3002', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  isProduction: process.env.NODE_ENV === 'production',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
  vtpassApiKey: process.env.VTPASS_API_KEY ?? '',
  vtpassPublicKey: process.env.VTPASS_PUBLIC_KEY ?? '',
  vtpassSecretKey: process.env.VTPASS_SECRET_KEY ?? '',
}));
