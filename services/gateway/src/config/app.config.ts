import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.GATEWAY_PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  services: {
    auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
    fiat: process.env.FIAT_SERVICE_URL ?? 'http://localhost:3002',
    crypto: process.env.CRYPTO_SERVICE_URL ?? 'http://localhost:3003',
    kyc: process.env.KYC_SERVICE_URL ?? 'http://localhost:3004',
    notifications: process.env.NOTIFICATIONS_SERVICE_URL ?? 'http://localhost:3005',
  },
}));
