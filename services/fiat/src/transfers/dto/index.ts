import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class BankTransferDto {
  @IsString()
  accountNumber: string;

  @IsString()
  bankCode: string;

  @IsString()
  bankName: string;

  @IsString()
  recipientName: string;

  @IsNumber()
  @Min(100)
  @Transform(({ value }) => Number(value))
  amount: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  narration?: string;

  @IsString()
  pin: string;
}

export class ResolveAccountDto {
  @IsString()
  accountNumber: string;

  @IsString()
  bankCode: string;
}
