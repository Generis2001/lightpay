import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Patch,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestPhoneVerificationDto, VerifyPhoneDto } from './dto/verify-phone.dto';
import { RequestEmailVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  RegisterPhoneDto,
  RegisterEmailDto,
  LoginRequestDto,
  VerifyOtpDto,
  SetPinDto,
  RefreshTokenDto,
  EnableBiometricDto,
  ChangePinDto,
  ResendOtpDto,
} from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/phone')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Register with phone number' })
  async registerPhone(
    @Body() dto: RegisterPhoneDto,
    @Ip() ip: string,
  ) {
    return this.authService.registerPhone(dto, ip);
  }

  @Post('register/email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Register with email address' })
  async registerEmail(@Body() dto: RegisterEmailDto, @Ip() ip: string) {
    return this.authService.registerEmail(dto, ip);
  }

  @Post('login/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request OTP for login' })
  async loginRequest(@Body() dto: LoginRequestDto, @Ip() ip: string) {
    return this.authService.requestLoginOtp(dto, ip);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify OTP code' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Ip() ip: string,
    @Headers('x-device-id') deviceId?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.verifyOtp(dto, ip, deviceId, userAgent);
  }

  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Resend OTP code' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('pin/set')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set transaction PIN (requires auth token from OTP verify)' })
  async setPin(
    @Request() req: any,
    @Body() dto: SetPinDto,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.authService.setPinForUser(req.user.sub, dto.pin, deviceId);
  }

  @Post('pin/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change transaction PIN' })
  async changePin(@Request() req: any, @Body() dto: ChangePinDto) {
    return this.authService.changePin(req.user.sub, dto);
  }

  @Post('pin/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyPin(@Request() req: any, @Body() dto: SetPinDto) {
    const verified = await this.authService.verifyPin(req.user.sub, dto.pin);
    return { success: verified, data: { verified } };
  }

  @Post('biometric/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable biometric authentication' })
  async enableBiometric(
    @Request() req: any,
    @Body() dto: EnableBiometricDto,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.authService.enableBiometric(req.user.sub, dto, deviceId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() dto: RefreshTokenDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.refreshToken(dto, deviceId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke session' })
  async logout(@Request() req: any, @Body() body: { refreshToken?: string }) {
    return this.authService.logout(req.user.sub, req.user.sessionId);
  }

  @Post('phone/request')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async requestPhone(@Request() req: any, @Body() dto: RequestPhoneVerificationDto) { return this.authService.requestPhoneVerification(req.user.sub, dto.phone); }
  @Post('phone/verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyPhone(@Request() req: any, @Body() dto: VerifyPhoneDto) { return this.authService.verifyPhone(req.user.sub, dto.phone, dto.code); }

  @Post('email/request')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async requestEmail(@Request() req: any, @Body() dto: RequestEmailVerificationDto) { return this.authService.requestEmailVerification(req.user.sub, dto.email); }

  @Post('email/verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyEmail(@Request() req: any, @Body() dto: VerifyEmailDto) { return this.authService.verifyEmail(req.user.sub, dto.email, dto.code); }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async session(@Request() req: any) {
    return { success: true, data: { userId: req.user.sub, sessionId: req.user.sessionId,
      kycTier: req.user.kycTier, kycStatus: req.user.kycStatus } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.sub, dto);
  }
}
