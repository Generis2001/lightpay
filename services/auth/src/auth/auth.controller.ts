import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set transaction PIN' })
  async setPin(
    @Body() dto: SetPinDto,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.authService.setPin(dto, deviceId);
  }

  @Post('pin/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change transaction PIN' })
  async changePin(@Request() req: any, @Body() dto: ChangePinDto) {
    return this.authService.changePin(req.user.sub, dto);
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
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke session' })
  async logout(@Request() req: any, @Body() body: { refreshToken?: string }) {
    return this.authService.logout(req.user.sessionId, body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.sub);
  }
}
