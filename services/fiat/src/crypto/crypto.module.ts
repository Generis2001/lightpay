import { Module, Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IsIn, IsString, IsOptional, Matches, MaxLength, IsUUID } from 'class-validator';
import { CryptoService } from './crypto.service';
import { FireblocksProvider, CRYPTO_NETWORKS } from './fireblocks.provider';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TransactionPinGuard } from '../common/guards/transaction-pin.guard';
import { successResponse } from '../common/response';

class CryptoQuoteDto {
  @IsIn(['BTC', 'ETH', 'SOL', 'BNB']) symbol!: string;
  @IsString() @MaxLength(50) network!: string;
  @IsString() @MaxLength(255) address!: string;
  @Matches(/^\d+(\.\d{1,18})?$/) @MaxLength(40) amount!: string;
  @IsOptional() @IsString() @MaxLength(255) tag?: string;
}
class CryptoSendDto { @IsUUID() quoteId!: string; @Matches(/^\d{6}$/) pin!: string; }
@Controller('crypto')
@UseGuards(JwtAuthGuard)
export class CryptoController {
  constructor(private readonly crypto: CryptoService, private readonly provider: FireblocksProvider) {}
  @Get('assets') assets() { return successResponse(Object.entries(CRYPTO_NETWORKS).map(([symbol, asset]) => ({ symbol, network: asset.network, decimals: asset.decimals, enabled: this.provider.configured() }))); }
  @Post('wallets/:symbol') async provision(@Req() req: any, @Param('symbol') symbol: string) { return successResponse(await this.crypto.provision(req.user.sub, symbol)); }
  @Post('quotes') async quote(@Req() req: any, @Body() dto: CryptoQuoteDto) { return successResponse(await this.crypto.quote(req.user.sub, dto)); }
  @Post('send') @UseGuards(TransactionPinGuard) async send(@Req() req: any, @Body() dto: CryptoSendDto) { return successResponse(await this.crypto.send(req.user.sub, dto.quoteId)); }
}
@Module({ imports: [JwtModule.register({})], controllers: [CryptoController], providers: [CryptoService, FireblocksProvider, JwtAuthGuard, TransactionPinGuard] })
export class CryptoModule {}
