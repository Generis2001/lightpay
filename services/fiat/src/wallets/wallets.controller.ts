import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';
import { BeneficiaryService } from './beneficiary.service';
import { successResponse } from '../common/response';

interface AuthRequest extends Request {
  user: { sub: string; email?: string; phone?: string };
}

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly beneficiaryService: BeneficiaryService,
  ) {}

  @Get()
  async getMyWallets(@Req() req: AuthRequest) {
    const wallets = await this.walletsService.getUserWallets(req.user.sub);
    return successResponse(wallets);
  }

  @Get('beneficiaries')
  async getBeneficiaries(@Req() req: AuthRequest) {
    const beneficiaries = await this.beneficiaryService.getUserBeneficiaries(req.user.sub);
    return successResponse(beneficiaries);
  }

  @Post('beneficiaries/:id/favourite')
  async toggleFavourite(@Param('id') id: string, @Req() req: AuthRequest) {
    const beneficiary = await this.beneficiaryService.toggleFavourite(id, req.user.sub);
    return successResponse(beneficiary);
  }

  @Delete('beneficiaries/:id')
  async deleteBeneficiary(@Param('id') id: string, @Req() req: AuthRequest) {
    await this.beneficiaryService.deleteBeneficiary(id, req.user.sub);
    return successResponse(null, 'Beneficiary removed');
  }
}
