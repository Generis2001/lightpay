import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../transactions/transaction.entity';
import { Beneficiary } from '../wallets/beneficiary.entity';
import { PaystackProvider } from '../providers/paystack.provider';
import { WalletsService } from '../wallets/wallets.service';
import { BeneficiaryService } from '../wallets/beneficiary.service';
import { VirtualAccount } from '../wallets/virtual-account.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, Beneficiary, VirtualAccount]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [TransfersController],
  providers: [TransfersService, WalletsService, BeneficiaryService, PaystackProvider, JwtAuthGuard],
  exports: [TransfersService],
})
export class TransfersModule {}
