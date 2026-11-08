import { Module, Controller, Get, Post, Req, Param, Body, Headers, UseGuards, BadRequestException, UnauthorizedException, RawBodyRequest, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { JwtModule } from '@nestjs/jwt';
import { IsNumber, Min, Max, IsInt } from 'class-validator';
import { BillsModule } from '../bills/bills.module';
import { TransfersModule } from '../transfers/transfers.module';
import { ReconciliationService } from './reconciliation.service';
import { WalletsModule } from '../wallets/wallets.module';
import { PaystackProvider } from '../providers/paystack.provider';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { successResponse } from '../common/response';

class FundingDto { @IsNumber({ maxDecimalPlaces: 2 }) @Min(100) @Max(1000000) amount!: number; }
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post('virtual-account') async provision(@Req() req: any) { return successResponse(await this.payments.provision(req.user.sub, req.headers.authorization)); }
  @Post('funding') async fund(@Req() req: any, @Body() dto: FundingDto, @Headers('idempotency-key') key: string) {
    if (!key || !/^[A-Za-z0-9_-]{16,120}$/.test(key)) throw new BadRequestException('A valid Idempotency-Key is required');
    return successResponse(await this.payments.initialize(req.user.sub, req.headers.authorization, dto.amount, key));
  }
  @Get('funding/:reference') async status(@Req() req: any, @Param('reference') reference: string) { return successResponse(await this.payments.checkFunding(req.user.sub, reference)); }
}
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly provider: PaystackProvider, private readonly payments: PaymentsService) {}
  @Post('paystack') @HttpCode(200) async paystack(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature: string) {
    if (!req.rawBody || !(await this.provider.verifyWebhook(req.rawBody, signature ?? ''))) throw new UnauthorizedException('Invalid webhook signature');
    const event = req.body;
    if (!['charge.success', 'transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event?.event)) return { received: true };
    const reference = event?.data?.reference;
    if (typeof reference !== 'string' || reference.length > 100) throw new BadRequestException('Invalid event reference');
    if (event.event === 'charge.success') await this.payments.settlePayment(reference);
    if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event.event)) await this.payments.settleTransfer(reference);
    return { received: true };
  }
}
@Module({ imports: [WalletsModule, BillsModule, TransfersModule, JwtModule.register({})], controllers: [PaymentsController, WebhooksController], providers: [PaymentsService, PaystackProvider, JwtAuthGuard, ReconciliationService], exports: [PaymentsService] })
export class PaymentsModule {}
