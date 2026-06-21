import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../transactions/transaction.entity';
import { VirtualAccount } from '../wallets/virtual-account.entity';
import { Beneficiary } from '../wallets/beneficiary.entity';
import { WalletsService } from '../wallets/wallets.service';
import { PaystackProvider } from '../providers/paystack.provider';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, VirtualAccount, Beneficiary]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [BillsController],
  providers: [BillsService, WalletsService, PaystackProvider, JwtAuthGuard],
  exports: [BillsService],
})
export class BillsModule {}
