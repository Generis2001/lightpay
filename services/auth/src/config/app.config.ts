import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD ?? 'lightpay_redis_secret',
  otpExpirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS ?? '300', 10),
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
  pinMaxAttempts: parseInt(process.env.PIN_MAX_ATTEMPTS ?? '5', 10),
  pinLockoutDuration: parseInt(process.env.PIN_LOCKOUT_DURATION ?? '86400', 10), // 24h
  smsProvider: process.env.SMS_PROVIDER ?? 'termii',
  termiiApiKey: process.env.TERMII_API_KEY ?? '',
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? '',
  fromEmail: process.env.FROM_EMAIL ?? 'noreply@lightpay.ng',
}));
