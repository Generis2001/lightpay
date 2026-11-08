import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('Set a shared JWT_SECRET of at least 32 characters before production startup');
  return ({
  port: parseInt(process.env.GATEWAY_PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  services: {
    auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
    fiat: process.env.FIAT_SERVICE_URL ?? 'http://localhost:3002',
    crypto: process.env.CRYPTO_SERVICE_URL ?? 'http://localhost:3003',
    kyc: process.env.KYC_SERVICE_URL ?? 'http://localhost:3004',
    notifications: process.env.NOTIFICATIONS_SERVICE_URL ?? 'http://localhost:3005',
  },
});
});
