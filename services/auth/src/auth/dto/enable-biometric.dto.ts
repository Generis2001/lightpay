import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnableBiometricDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  biometricPublicKey?: string;

  @ApiProperty()
  @IsString()
  deviceId: string;
}
