import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  GoneException,
} from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import {
  IsIn,
  IsString,
  IsOptional,
  Matches,
  MaxLength,
  IsUUID,
} from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TransactionPinGuard } from "../common/guards/transaction-pin.guard";
import { successResponse } from "../common/response";

class CryptoQuoteDto {
  @IsIn(["BTC", "ETH", "SOL", "BNB"]) symbol!: string;
  @IsString() @MaxLength(50) network!: string;
  @IsString() @MaxLength(255) address!: string;
  @Matches(/^\d+(\.\d{1,18})?$/) @MaxLength(40) amount!: string;
  @IsOptional() @IsString() @MaxLength(255) tag?: string;
}
class CryptoSendDto {
  @IsUUID() quoteId!: string;
  @Matches(/^\d{6}$/) pin!: string;
}
const NETWORKS = {
  BTC: { network: "Bitcoin", decimals: 8 },
  ETH: { network: "Ethereum", decimals: 18 },
  SOL: { network: "Solana", decimals: 9 },
  BNB: { network: "BNB Smart Chain", decimals: 18 },
};
const retired = () =>
  new GoneException(
    "Update Lightpay to create or import a wallet on your device. Server custody has been retired.",
  );
@Controller("crypto")
@UseGuards(JwtAuthGuard)
export class CryptoController {
  @Get("assets") assets() {
    return successResponse(
      Object.entries(NETWORKS).map(([symbol, asset]) => ({
        symbol,
        ...asset,
        mode: "self-custody",
        enabled: false,
        custodyEnabled: false,
      })),
    );
  }
  @Post("wallets/:symbol") provision(
    @Req() _req: any,
    @Param("symbol") _symbol: string,
  ): never {
    throw retired();
  }
  @Post("quotes") quote(@Req() _req: any, @Body() _dto: CryptoQuoteDto): never {
    throw retired();
  }
  @Post("send") @UseGuards(TransactionPinGuard) send(
    @Req() _req: any,
    @Body() _dto: CryptoSendDto,
  ): never {
    throw retired();
  }
}
@Module({
  imports: [JwtModule.register({})],
  controllers: [CryptoController],
  providers: [JwtAuthGuard, TransactionPinGuard],
})
export class CryptoModule {}
