import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePinDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  currentPin: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'New PIN must contain only digits' })
  newPin: string;
}
