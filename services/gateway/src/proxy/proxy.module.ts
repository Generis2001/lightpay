import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import proxy from 'express-http-proxy';

interface ServiceUrls {
  auth: string;
  fiat: string;
  crypto: string;
  kyc: string;
  notifications: string;
}

@Module({})
export class ProxyModule implements NestModule {
  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const services = this.configService.get<ServiceUrls>('app.services');
    if (!services) return;

    // Auth service — public routes, no JWT check at gateway level
    consumer.apply(proxy(services.auth, {
      parseReqBody: false,
      proxyReqPathResolver: (req: import('express').Request) => req.originalUrl,
    })).forRoutes({ path: 'auth', method: RequestMethod.ALL }, { path: 'auth/*', method: RequestMethod.ALL });

    // Fiat service — wallets, transfers, bills, transactions
    consumer
      .apply(
        proxy(services.fiat, {
          parseReqBody: false,
      proxyReqPathResolver: (req: import('express').Request) =>
            req.originalUrl.replace(/^\/api\/v1/, ''),
        }),
      )
      .forRoutes(
        ...['wallets', 'transfers', 'bills', 'transactions', 'notifications', 'webhooks', 'crypto', 'international'].flatMap((path) => [
          { path, method: RequestMethod.ALL },
          { path: `${path}/*`, method: RequestMethod.ALL },
        ]),
      );

    consumer.apply(proxy(services.auth, {
      parseReqBody: false,
      proxyReqPathResolver: (req: import('express').Request) => req.originalUrl,
    })).forRoutes({ path: 'kyc', method: RequestMethod.ALL }, { path: 'kyc/*', method: RequestMethod.ALL });
  }
}
