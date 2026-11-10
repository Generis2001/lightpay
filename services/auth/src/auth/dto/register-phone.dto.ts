import { IsString, Matches, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterPhoneDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @Matches(/^\+234[789][01]\d{8}$/, {
    message: 'Phone must be a valid Nigerian number in +234 format',
  })
  phone!: string;

  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsOptional()
  @IsString()
  @Length(6, 10)
  referralCode?: string;
}
