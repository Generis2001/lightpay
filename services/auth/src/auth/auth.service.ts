import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/user.entity';
import { UserAuth } from '../users/user-auth.entity';
import { OtpService } from '../otp/otp.service';
import { DevicesService } from '../devices/devices.service';
import type {
  RegisterPhoneDto,
  RegisterEmailDto,
  LoginRequestDto,
  VerifyOtpDto,
  RefreshTokenDto,
  EnableBiometricDto,
  ChangePinDto,
  ResendOtpDto,
} from './dto';
import { ApiResponse } from '../common/response';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserAuth)
    private readonly userAuthRepo: Repository<UserAuth>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    private readonly devicesService: DevicesService,
  ) {}

  async registerPhone(dto: RegisterPhoneDto, ip: string): Promise<ApiResponse> {
    const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictException({
        code: 'PHONE_TAKEN',
        message: 'An account with this phone number already exists',
      });
    }

    await this.otpService.sendOtp({
      identifier: dto.phone,
      method: 'phone',
      purpose: 'registration',
    });

    return ApiResponse.success(
      { message: `OTP sent to ${dto.phone}` },
      'OTP sent successfully',
    );
  }

  async registerEmail(dto: RegisterEmailDto, ip: string): Promise<ApiResponse> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'An account with this email address already exists',
      });
    }

    await this.otpService.sendOtp({
      identifier: dto.email,
      method: 'email',
      purpose: 'registration',
    });

    return ApiResponse.success(
      { message: `OTP sent to ${dto.email}` },
      'OTP sent successfully',
    );
  }

  async requestLoginOtp(dto: LoginRequestDto, ip: string): Promise<ApiResponse> {
    let user: User | null = null;
    if (dto.method === 'phone') {
      user = await this.userRepo.findOne({ where: { phone: dto.identifier } });
    } else {
      user = await this.userRepo.findOne({ where: { email: dto.identifier } });
    }

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'No account found' });
    }

    if (!user.isActive || user.isBlocked) {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' });
    }

    await this.otpService.sendOtp({
      identifier: dto.identifier,
      method: dto.method,
      purpose: 'login',
    });

    return ApiResponse.success({ message: 'OTP sent' }, 'OTP sent');
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    ip: string,
    deviceId?: string,
    userAgent?: string,
  ): Promise<ApiResponse> {
    await this.otpService.verifyOtp({
      identifier: dto.identifier,
      method: dto.method as 'phone' | 'email',
      code: dto.code,
      purpose: dto.purpose,
    });

    if (dto.purpose === 'registration') {
      const user = await this.createUser(dto.identifier, dto.method as 'phone' | 'email');
      return ApiResponse.success(
        { user: this.serializeUser(user), isNewUser: true },
        'Registration successful',
      );
    }

    if (dto.purpose === 'login') {
      let user: User | null = null;
      if (dto.method === 'phone') {
        user = await this.userRepo.findOne({
          where: { phone: dto.identifier },
          relations: ['auth'],
        });
      } else {
        user = await this.userRepo.findOne({
          where: { email: dto.identifier },
          relations: ['auth'],
        });
      }

      if (!user) throw new NotFoundException('User not found');

      user.lastLoginAt = new Date();
      await this.userRepo.save(user);

      const tokens = await this.generateTokens(user.id, deviceId);

      return ApiResponse.success(
        {
          user: this.serializeUser(user, user.auth),
          tokens,
          isNewUser: false,
        },
        'Login successful',
      );
    }

    return ApiResponse.success({ verified: true }, 'OTP verified');
  }

  async resendOtp(dto: ResendOtpDto): Promise<ApiResponse> {
    await this.otpService.sendOtp({
      identifier: dto.identifier,
      method: dto.method as 'phone' | 'email',
      purpose: dto.purpose,
    });
    return ApiResponse.success({ sent: true }, 'OTP resent');
  }

  async setPinForUser(userId: string, pin: string, deviceId?: string): Promise<ApiResponse> {
    const COMMON_PINS = ['123456', '654321', '111111', '000000', '123123'];
    if (COMMON_PINS.includes(pin)) {
      throw new BadRequestException('This PIN is too common. Please choose a more unique PIN.');
    }

    let userAuth = await this.userAuthRepo.findOne({ where: { userId } });
    if (!userAuth) {
      userAuth = this.userAuthRepo.create({ userId });
    }

    userAuth.pinHash = await argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    userAuth.failedAttempts = 0;
    userAuth.lockedUntil = null;
    await this.userAuthRepo.save(userAuth);

    const tokens = await this.generateTokens(userId, deviceId);

    return ApiResponse.success(
      {
        tokens,
        user: { hasPin: true },
      },
      'PIN set successfully',
    );
  }

  async changePin(userId: string, dto: ChangePinDto): Promise<ApiResponse> {
    const userAuth = await this.userAuthRepo.findOne({ where: { userId } });
    if (!userAuth?.pinHash) {
      throw new BadRequestException('No PIN set for this account');
    }

    if (userAuth.lockedUntil && new Date() < userAuth.lockedUntil) {
      throw new ForbiddenException({
        code: 'PIN_LOCKED',
        message: 'Account is temporarily locked due to too many failed attempts',
      });
    }

    const isValid = await argon2.verify(userAuth.pinHash, dto.currentPin);
    if (!isValid) {
      userAuth.failedAttempts += 1;
      const maxAttempts = this.config.get<number>('app.pinMaxAttempts') ?? 5;
      if (userAuth.failedAttempts >= maxAttempts) {
        const lockDuration = this.config.get<number>('app.pinLockoutDuration') ?? 86400;
        userAuth.lockedUntil = new Date(Date.now() + lockDuration * 1000);
      }
      await this.userAuthRepo.save(userAuth);
      throw new UnauthorizedException({ code: 'INVALID_PIN', message: 'Incorrect current PIN' });
    }

    userAuth.pinHash = await argon2.hash(dto.newPin, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    userAuth.failedAttempts = 0;
    userAuth.lockedUntil = null;
    await this.userAuthRepo.save(userAuth);

    return ApiResponse.success({ changed: true }, 'PIN changed successfully');
  }

  async enableBiometric(
    userId: string,
    dto: EnableBiometricDto,
    deviceId?: string,
  ): Promise<ApiResponse> {
    const userAuth = await this.userAuthRepo.findOne({ where: { userId } });
    if (!userAuth) throw new NotFoundException('User auth not found');

    userAuth.biometricKey = dto.biometricPublicKey ?? 'enabled';
    await this.userAuthRepo.save(userAuth);

    if (deviceId) {
      await this.devicesService.markBiometricEnabled(deviceId, userId);
    }

    return ApiResponse.success({ biometricEnabled: true }, 'Biometric enabled');
  }

  async refreshToken(dto: RefreshTokenDto): Promise<ApiResponse> {
    // Validate refresh token — simplified implementation
    // In production: look up refresh token in DB, verify not revoked
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.config.get('app.jwtSecret'),
      });
      const tokens = await this.generateTokens(payload.sub, payload.deviceId);
      return ApiResponse.success({ tokens }, 'Token refreshed');
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
    }
  }

  async logout(sessionId?: string, refreshToken?: string): Promise<ApiResponse> {
    // Revoke session in Redis/DB
    return ApiResponse.success({ loggedOut: true }, 'Logged out');
  }

  async getMe(userId: string): Promise<ApiResponse> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['auth'],
    });
    if (!user) throw new NotFoundException('User not found');
    return ApiResponse.success(this.serializeUser(user, user.auth), 'User fetched');
  }

  async verifyPin(userId: string, pin: string): Promise<boolean> {
    const userAuth = await this.userAuthRepo.findOne({ where: { userId } });
    if (!userAuth?.pinHash) return false;

    if (userAuth.lockedUntil && new Date() < userAuth.lockedUntil) {
      throw new ForbiddenException({ code: 'PIN_LOCKED', message: 'Account temporarily locked' });
    }

    const isValid = await argon2.verify(userAuth.pinHash, pin);

    if (!isValid) {
      userAuth.failedAttempts += 1;
      const maxAttempts = this.config.get<number>('app.pinMaxAttempts') ?? 5;
      if (userAuth.failedAttempts >= maxAttempts) {
        const lockDuration = this.config.get<number>('app.pinLockoutDuration') ?? 86400;
        userAuth.lockedUntil = new Date(Date.now() + lockDuration * 1000);
      }
      await this.userAuthRepo.save(userAuth);
      throw new UnauthorizedException({ code: 'INVALID_PIN', message: 'Incorrect PIN' });
    }

    userAuth.failedAttempts = 0;
    await this.userAuthRepo.save(userAuth);
    return true;
  }

  private async createUser(identifier: string, method: 'phone' | 'email'): Promise<User> {
    const user = this.userRepo.create({
      phone: method === 'phone' ? identifier : null,
      phoneVerified: method === 'phone',
      email: method === 'email' ? identifier : null,
      emailVerified: method === 'email',
      referralCode: this.generateReferralCode(),
    });
    await this.userRepo.save(user);

    const userAuth = this.userAuthRepo.create({ userId: user.id });
    await this.userAuthRepo.save(userAuth);

    return user;
  }

  private async generateTokens(userId: string, deviceId?: string) {
    const sessionId = uuidv4();
    const payload = { sub: userId, deviceId, sessionId };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('app.jwtExpiresIn') ?? '15m',
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: this.config.get('app.refreshTokenExpiresIn') ?? '30d' },
    );

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private serializeUser(user: User, auth?: UserAuth | null) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      kycTier: user.kycTier,
      kycStatus: user.kycStatus,
      referralCode: user.referralCode,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      hasPin: !!auth?.pinHash,
      hasBiometric: !!auth?.biometricKey,
      createdAt: user.createdAt,
    };
  }
}
