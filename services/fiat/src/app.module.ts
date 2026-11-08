import { HealthModule } from './health/health.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { InternationalModule } from './international/international.module';
import { CryptoModule } from './crypto/crypto.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WalletsModule } from './wallets/wallets.module';
import { TransfersModule } from './transfers/transfers.module';
import { BillsModule } from './bills/bills.module';
import { TransactionsModule } from './transactions/transactions.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';

@Module({
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...config.get('database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    InternationalModule,
    CryptoModule,
    PaymentsModule,
    NotificationsModule,
    WalletsModule,
    TransfersModule,
    BillsModule,
    TransactionsModule,
  ],
})
export class AppModule {}
