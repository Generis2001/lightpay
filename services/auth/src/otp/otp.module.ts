import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpChallenge } from './otp.entity';
import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';

@Module({
  imports: [TypeOrmModule.forFeature([OtpChallenge])],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
