import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ description: 'Phone number or email' })
  @IsString()
  identifier: string;

  @ApiProperty({ enum: ['phone', 'email'] })
  @IsIn(['phone', 'email'])
  method: 'phone' | 'email';
}
