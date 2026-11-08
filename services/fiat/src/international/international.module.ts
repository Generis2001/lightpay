import { Module, Controller, Get, Post, Req, Query, Body, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IsIn, IsString, MaxLength, IsNumber, Min, Max, IsOptional, IsUUID, Matches } from 'class-validator';
import { WalletsModule } from '../wallets/wallets.module';
import { FlutterwaveProvider, AFRICAN_CORRIDORS } from './flutterwave.provider';
import { InternationalService } from './international.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TransactionPinGuard } from '../common/guards/transaction-pin.guard';
import { successResponse } from '../common/response';
class InternationalQuoteDto {
  @IsIn(AFRICAN_CORRIDORS.map((c) => c.country)) country!: string;
  @IsString() @MaxLength(20) bankCode!: string;
  @Matches(/^[A-Za-z0-9-]{4,34}$/) accountNumber!: string;
  @IsString() @MaxLength(100) recipientName!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(100) @Max(1000000) amount!: number;
  @IsOptional() @IsString() @MaxLength(10) branchCode?: string;
  @IsOptional() @IsString() @MaxLength(100) narration?: string;
}
class InternationalSendDto { @IsUUID() quoteId!: string; @Matches(/^\d{6}$/) pin!: string; }
@Controller('international') @UseGuards(JwtAuthGuard)
export class InternationalController {
  constructor(private readonly provider: FlutterwaveProvider, private readonly international: InternationalService) {}
  @Get('corridors') corridors() { return successResponse(this.provider.corridors()); }
  @Get('banks') async banks(@Query('country') country: string) { return successResponse(await this.provider.banks(country)); }
  @Get('branches') async branches(@Query('bankId') bankId: string) { if (!/^\d+$/.test(bankId)) throw new BadRequestException('Invalid bank'); return successResponse(await this.provider.branches(Number(bankId))); }
  @Post('quotes') async quote(@Req() req: any, @Body() dto: InternationalQuoteDto) { return successResponse(await this.international.quote(req.user.sub, req.headers.authorization, dto)); }
  @Post('send') @UseGuards(TransactionPinGuard) async send(@Req() req: any, @Body() dto: InternationalSendDto) { if (req.user.kycTier < 2 || req.user.kycStatus !== 'approved') throw new ForbiddenException('Full identity verification required'); return successResponse(await this.international.send(req.user.sub, dto.quoteId)); }
}
@Module({ imports: [WalletsModule, JwtModule.register({})], controllers: [InternationalController], providers: [InternationalService, FlutterwaveProvider, JwtAuthGuard, TransactionPinGuard] })
export class InternationalModule {}
