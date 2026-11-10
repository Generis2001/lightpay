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
import { SessionsService } from './sessions.service';
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
    private readonly sessionsService: SessionsService,
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
    dto = { ...dto, email: dto.email.trim().toLowerCase() };
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
    if (dto.method === 'email') dto = { ...dto, identifier: dto.identifier.trim().toLowerCase() };
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
    if (dto.method === 'email') dto = { ...dto, identifier: dto.identifier.trim().toLowerCase() };
    if (deviceId && deviceId.length > 255) throw new BadRequestException("Invalid device identifier");
    await this.otpService.verifyOtp({
      identifier: dto.identifier,
      method: dto.method as 'phone' | 'email',
      code: dto.code,
      purpose: dto.purpose,
    });

    if (dto.purpose === 'registration') {
      const user = await this.createUser(dto.identifier, dto.method as 'phone' | 'email');
      if (deviceId) await this.devicesService.registerDevice({ userId: user.id, deviceId });
      const tokens = await this.generateTokens(user.id, deviceId);
      return ApiResponse.success(
        { user: this.serializeUser(user), tokens, isNewUser: true },
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
      if (!user.isActive || user.isBlocked) throw new ForbiddenException('Account suspended');

      user.lastLoginAt = new Date();
      await this.userRepo.save(user);

      if (deviceId) await this.devicesService.registerDevice({ userId: user.id, deviceId });
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
    if (dto.method === 'email') dto = { ...dto, identifier: dto.identifier.trim().toLowerCase() };
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
    if (userAuth.pinHash) {
      throw new BadRequestException('Use Change PIN to update an existing PIN.');
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

  async refreshToken(dto: RefreshTokenDto, deviceId?: string): Promise<ApiResponse> {
    const tokens = await this.sessionsService.refresh(dto.refreshToken, deviceId);
    return ApiResponse.success({ tokens }, 'Token refreshed');
  }

  async logout(userId: string, sessionId: string): Promise<ApiResponse> {
    await this.sessionsService.revoke(userId, sessionId);
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

  async requestPhoneVerification(userId: string, phone: string) {
    const existing = await this.userRepo.findOne({ where: { phone } });
    if (existing && existing.id !== userId) throw new ConflictException('Phone already belongs to another account');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user?.phoneVerified && user.phone !== phone) throw new BadRequestException('Contact changes require account recovery support');
    await this.otpService.sendOtp({ identifier: phone, method: 'phone', purpose: `phone:${userId}` });
    return ApiResponse.success({ sent: true }, 'Verification code sent');
  }
  async verifyPhone(userId: string, phone: string, code: string) {
    await this.otpService.verifyOtp({ identifier: phone, method: 'phone', code, purpose: `phone:${userId}` });
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || (user.phoneVerified && user.phone !== phone)) throw new BadRequestException('Contact cannot be changed');
    await this.userRepo.update(userId, { phone, phoneVerified: true }); return this.getMe(userId);
  }

  async requestEmailVerification(userId: string, email: string) {
    email = email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing && existing.id !== userId) throw new ConflictException('Email already belongs to another account');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user?.emailVerified && user.email !== email) throw new BadRequestException('Contact changes require account recovery support');
    await this.otpService.sendOtp({ identifier: email, method: 'email', purpose: `email:${userId}` });
    return ApiResponse.success({ sent: true }, 'Verification code sent');
  }

  async verifyEmail(userId: string, email: string, code: string) {
    email = email.trim().toLowerCase();
    await this.otpService.verifyOtp({ identifier: email, method: 'email', code, purpose: `email:${userId}` });
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || (user.emailVerified && user.email !== email)) throw new BadRequestException('Contact cannot be changed');
    await this.userRepo.update(userId, { email, emailVerified: true });
    return this.getMe(userId);
  }

  async updateProfile(userId: string, profile: { firstName: string; lastName: string }): Promise<ApiResponse> {
    const firstName = profile.firstName.trim();
    const lastName = profile.lastName.trim();
    if (!firstName || !lastName) throw new BadRequestException('Enter your first and last name');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user?.kycTier && user.kycStatus === 'approved' && (user.firstName !== firstName || user.lastName !== lastName)) throw new BadRequestException('Verified names require a new identity review to change');
    await this.userRepo.update(userId, { firstName, lastName });
    return this.getMe(userId);
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
    return this.sessionsService.create(userId, deviceId);
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
