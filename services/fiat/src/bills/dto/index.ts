import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class PurchaseAirtimeDto {
  @IsString()
  network: string;

  @IsString()
  phone: string;

  @IsNumber()
  @Min(50)
  @Transform(({ value }) => Number(value))
  amount: number;

  @IsString()
  pin: string;
}

export class PurchaseDataDto {
  @IsString()
  network: string;

  @IsString()
  phone: string;

  @IsString()
  planCode: string;

  @IsNumber()
  @Min(50)
  @Transform(({ value }) => Number(value))
  amount: number;

  @IsString()
  pin: string;
}

export class GetDataPlansDto {
  @IsString()
  network: string;
}

export class VerifyMeterDto {
  @IsString()
  meterNumber: string;

  @IsString()
  disco: string;

  @IsString()
  meterType: string;
}

export class PayElectricityDto {
  @IsString()
  meterNumber: string;

  @IsString()
  disco: string;

  @IsString()
  meterType: string;

  @IsNumber()
  @Min(500)
  @Transform(({ value }) => Number(value))
  amount: number;

  @IsString()
  customerName: string;

  @IsString()
  pin: string;
}

export class GetCablePlansDto {
  @IsString()
  provider: string;
}

export class VerifySmartCardDto {
  @IsString()
  smartCardNumber: string;

  @IsString()
  provider: string;
}

export class PayCableDto {
  @IsString()
  smartCardNumber: string;

  @IsString()
  provider: string;

  @IsString()
  planCode: string;

  @IsNumber()
  @Min(100)
  @Transform(({ value }) => Number(value))
  amount: number;

  @IsString()
  customerName: string;

  @IsString()
  pin: string;
}
