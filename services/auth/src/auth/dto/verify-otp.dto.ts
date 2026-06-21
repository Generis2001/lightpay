import { IsString, IsIn, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ description: 'Phone number or email address' })
  @IsString()
  identifier: string;

  @ApiProperty({ enum: ['phone', 'email'] })
  @IsIn(['phone', 'email'])
  method: 'phone' | 'email';

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  code: string;

  @ApiProperty({ enum: ['registration', 'login', 'transaction', 'reset_pin', 'kyc'] })
  @IsIn(['registration', 'login', 'transaction', 'reset_pin', 'kyc'])
  purpose: string;
}
