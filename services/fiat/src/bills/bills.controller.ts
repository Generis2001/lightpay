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
import { BillsService } from './bills.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  PurchaseAirtimeDto,
  PurchaseDataDto,
  GetDataPlansDto,
  VerifyMeterDto,
  PayElectricityDto,
  GetCablePlansDto,
  VerifySmartCardDto,
  PayCableDto,
} from './dto';
import { successResponse } from '../common/response';

interface AuthRequest extends Request {
  user: { sub: string };
}

@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly walletsService: WalletsService,
  ) {}

  private async getNgnWallet(userId: string) {
    const wallets = await this.walletsService.getUserWallets(userId);
    const wallet = wallets.find((w) => w.currency === 'NGN');
    if (!wallet) throw new BadRequestException('NGN wallet not found');
    return wallet;
  }

  @Post('airtime')
  @HttpCode(HttpStatus.OK)
  async purchaseAirtime(@Body() dto: PurchaseAirtimeDto, @Req() req: AuthRequest) {
    const wallet = await this.getNgnWallet(req.user.sub);
    const result = await this.billsService.purchaseAirtime({
      userId: req.user.sub,
      walletId: wallet.id,
      network: dto.network,
      phone: dto.phone,
      amount: dto.amount,
    });
    return successResponse(result, 'Airtime purchased successfully');
  }

  @Get('data/plans')
  async getDataPlans(@Query() dto: GetDataPlansDto) {
    const plans = await this.billsService.getDataPlans(dto.network);
    return successResponse(plans);
  }

  @Post('data')
  @HttpCode(HttpStatus.OK)
  async purchaseData(@Body() dto: PurchaseDataDto, @Req() req: AuthRequest) {
    const wallet = await this.getNgnWallet(req.user.sub);
    const result = await this.billsService.purchaseData({
      userId: req.user.sub,
      walletId: wallet.id,
      network: dto.network,
      phone: dto.phone,
      planCode: dto.planCode,
      amount: dto.amount,
    });
    return successResponse(result, 'Data purchase initiated');
  }

  @Get('electricity/verify-meter')
  async verifyMeter(@Query() dto: VerifyMeterDto) {
    const result = await this.billsService.verifyMeter({
      provider: dto.disco,
      meterNumber: dto.meterNumber,
      meterType: dto.meterType,
    });
    return successResponse(result);
  }

  @Post('electricity')
  @HttpCode(HttpStatus.OK)
  async payElectricity(@Body() dto: PayElectricityDto, @Req() req: AuthRequest) {
    const wallet = await this.getNgnWallet(req.user.sub);
    const result = await this.billsService.payElectricity({
      userId: req.user.sub,
      walletId: wallet.id,
      provider: dto.disco,
      meterNumber: dto.meterNumber,
      meterType: dto.meterType,
      amount: dto.amount,
    });
    return successResponse(result, 'Electricity payment successful');
  }

  @Get('cable/plans')
  async getCablePlans(@Query() dto: GetCablePlansDto) {
    const plans = await this.billsService.getCablePlans(dto.provider);
    return successResponse(plans);
  }

  @Get('cable/verify-card')
  async verifySmartCard(@Query() dto: VerifySmartCardDto) {
    if (process.env.NODE_ENV === 'development') {
      return successResponse({
        customerName: 'JOHN DOE',
        smartCardNumber: dto.smartCardNumber,
        provider: dto.provider,
      });
    }
    throw new BadRequestException('Smart card verification not available');
  }

  @Post('cable')
  @HttpCode(HttpStatus.OK)
  async payCable(@Body() dto: PayCableDto, @Req() req: AuthRequest) {
    const wallet = await this.getNgnWallet(req.user.sub);
    const result = await this.billsService.payCable({
      userId: req.user.sub,
      walletId: wallet.id,
      provider: dto.provider,
      smartcardNumber: dto.smartCardNumber,
      planCode: dto.planCode,
      amount: dto.amount,
    });
    return successResponse(result, 'Cable TV payment successful');
  }
}
