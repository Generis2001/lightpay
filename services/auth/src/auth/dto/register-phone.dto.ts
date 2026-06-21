import { IsString, Matches, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterPhoneDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @Matches(/^\+234[789][01]\d{8}$/, {
    message: 'Phone must be a valid Nigerian number in +234 format',
  })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(6, 10)
  referralCode?: string;
}
