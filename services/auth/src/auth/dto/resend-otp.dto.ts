import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty()
  @IsString()
  identifier: string;

  @ApiProperty({ enum: ['phone', 'email'] })
  @IsIn(['phone', 'email'])
  method: 'phone' | 'email';

  @ApiProperty({ enum: ['registration', 'login', 'transaction', 'reset_pin', 'kyc'] })
  @IsIn(['registration', 'login', 'transaction', 'reset_pin', 'kyc'])
  purpose: string;
}
