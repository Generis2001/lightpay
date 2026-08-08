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
    consumer.apply(proxy(services.auth)).forRoutes({
      path: '/api/v1/auth/*path',
      method: RequestMethod.ALL,
    });

    // Fiat service — wallets, transfers, bills, transactions
    consumer
      .apply(
        proxy(services.fiat, {
          proxyReqPathResolver: (req: import('express').Request) =>
            req.url.replace('/api/v1', ''),
        }),
      )
      .forRoutes(
        { path: '/api/v1/wallets/*path', method: RequestMethod.ALL },
        { path: '/api/v1/transfers/*path', method: RequestMethod.ALL },
        { path: '/api/v1/bills/*path', method: RequestMethod.ALL },
        { path: '/api/v1/transactions/*path', method: RequestMethod.ALL },
      );

    // KYC service — only registered when the upstream URL is configured
    if (process.env.KYC_SERVICE_URL) {
      consumer
        .apply(
          proxy(services.kyc, {
            proxyReqPathResolver: (req: import('express').Request) =>
              req.url.replace('/api/v1', ''),
          }),
        )
        .forRoutes({ path: '/api/v1/kyc/*path', method: RequestMethod.ALL });
    }

    // Notifications service — only registered when the upstream URL is configured
    if (process.env.NOTIFICATIONS_SERVICE_URL) {
      consumer
        .apply(
          proxy(services.notifications, {
            proxyReqPathResolver: (req: import('express').Request) =>
              req.url.replace('/api/v1', ''),
          }),
        )
        .forRoutes({
          path: '/api/v1/notifications/*path',
          method: RequestMethod.ALL,
        });
    }
  }
}
