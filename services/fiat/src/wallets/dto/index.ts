import { IsString, IsOptional, IsUUID } from 'class-validator';

export class ToggleFavouriteDto {
  @IsUUID()
  id: string;
}

export class DeleteBeneficiaryDto {
  @IsUUID()
  id: string;
}

export class GetBankListDto {}

export class ResolveAccountDto {
  @IsString()
  accountNumber: string;

  @IsString()
  bankCode: string;
}
