import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TransfersService } from './transfers.service';
import { WalletsService } from '../wallets/wallets.service';
import { BankTransferDto, ResolveAccountDto } from './dto';
import { successResponse } from '../common/response';

interface AuthRequest extends Request {
  user: { sub: string };
}

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly walletsService: WalletsService,
  ) {}

  @Get('banks')
  async getBankList() {
    const banks = await this.transfersService.getBankList();
    return successResponse(banks);
  }

  @Get('resolve')
  async resolveAccount(@Query() dto: ResolveAccountDto) {
    const result = await this.transfersService.resolveAccount(dto.accountNumber, dto.bankCode);
    return successResponse(result);
  }

  @Post('bank')
  @HttpCode(HttpStatus.OK)
  async bankTransfer(@Body() dto: BankTransferDto, @Req() req: AuthRequest) {
    const wallets = await this.walletsService.getUserWallets(req.user.sub);
    const ngnWallet = wallets.find((w) => w.currency === 'NGN');
    if (!ngnWallet) throw new BadRequestException('NGN wallet not found');

    const receipt = await this.transfersService.bankTransfer(req.user.sub, {
      walletId: ngnWallet.id,
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
      bankName: dto.bankName,
      accountName: dto.recipientName,
      amount: dto.amount as unknown as string,
      narration: dto.narration,
      saveBeneficiary: true,
    } as any);

    return successResponse(receipt, 'Transfer initiated successfully');
  }
}
