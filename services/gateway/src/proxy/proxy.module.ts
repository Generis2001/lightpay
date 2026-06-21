import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as proxy from 'express-http-proxy';

@Module({})
export class ProxyModule implements NestModule {
  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const services = this.configService.get<Record<string, string>>('app.services');
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
          proxyReqPathResolver: (req) =>
            req.url.replace('/api/v1', ''),
        }),
      )
      .forRoutes(
        { path: '/api/v1/wallets/*path', method: RequestMethod.ALL },
        { path: '/api/v1/transfers/*path', method: RequestMethod.ALL },
        { path: '/api/v1/bills/*path', method: RequestMethod.ALL },
        { path: '/api/v1/transactions/*path', method: RequestMethod.ALL },
      );

    // KYC service
    consumer
      .apply(
        proxy(services.kyc, {
          proxyReqPathResolver: (req) => req.url.replace('/api/v1', ''),
        }),
      )
      .forRoutes({ path: '/api/v1/kyc/*path', method: RequestMethod.ALL });

    // Notifications service
    consumer
      .apply(
        proxy(services.notifications, {
          proxyReqPathResolver: (req) => req.url.replace('/api/v1', ''),
        }),
      )
      .forRoutes({ path: '/api/v1/notifications/*path', method: RequestMethod.ALL });
  }
}
