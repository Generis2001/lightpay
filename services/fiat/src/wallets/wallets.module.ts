import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Wallet } from './wallet.entity';
import { VirtualAccount } from './virtual-account.entity';
import { Beneficiary } from './beneficiary.entity';
import { WalletsService } from './wallets.service';
import { BeneficiaryService } from './beneficiary.service';
import { WalletsController } from './wallets.controller';
import { Transaction } from '../transactions/transaction.entity';
import { PaystackProvider } from '../providers/paystack.provider';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, VirtualAccount, Beneficiary, Transaction]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [WalletsController],
  providers: [WalletsService, BeneficiaryService, PaystackProvider, JwtAuthGuard],
  exports: [WalletsService, BeneficiaryService],
})
export class WalletsModule {}
