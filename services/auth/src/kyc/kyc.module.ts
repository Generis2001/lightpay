import { Module, Controller, Get, Post, Body, Req, UseGuards, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHmac } from 'crypto';
import { IsIn, Matches, Equals, MaxLength } from 'class-validator';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Throttle } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { IdentityCheck } from './kyc.entity';
import { PremblyProvider, identityDate } from './prembly.provider';

class VerifyIdentityDto {
  @IsIn(['bvn', 'nin']) type!: 'bvn' | 'nin';
  @Matches(/^\d{11}$/) number!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) dateOfBirth!: string;
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/) @MaxLength(5000000) image!: string;
  @Equals(true) consent!: boolean;
}
const normalizeName = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
@Controller('kyc') @UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly db: DataSource, private readonly provider: PremblyProvider) {}
  @Get() async status(@Req() req: any) {
    const user = await this.db.getRepository(User).findOneByOrFail({ id: req.user.sub });
    const checks = await this.db.getRepository(IdentityCheck).findBy({ userId: req.user.sub });
    return { success: true, data: { available: this.provider.configured(), tier: user.kycTier, status: user.kycStatus,
      checks: checks.map((check) => ({ type: check.type, lastDigits: check.lastDigits, verifiedAt: check.verifiedAt })) } };
  }
  @Post('verify') @Throttle({ short: { limit: 2, ttl: 60000 }, long: { limit: 5, ttl: 3600000 } })
  async verify(@Req() req: any, @Body() dto: VerifyIdentityDto) {
    const userId = req.user.sub;
    const user = await this.db.getRepository(User).findOneByOrFail({ id: userId });
    if (!user.phoneVerified || !user.phone || !user.firstName || !user.lastName) throw new BadRequestException('Complete your name and verify a phone number first');
    if (dto.type === 'nin' && user.kycTier < 1) throw new BadRequestException('Verify your BVN before full identity verification');
    const birthDate = identityDate(dto.dateOfBirth);
    if (birthDate > new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0,10)) throw new ForbiddenException('Identity verification requires an adult account');
    const key = process.env.PREMBLY_IDENTITY_HASH_KEY;
    if (!key || key.length < 32) throw new BadRequestException('Identity verification is not configured');
    const identityHash = createHmac('sha256', key).update(`${dto.type}:${dto.number}`).digest('hex');
    const existing = await this.db.getRepository(IdentityCheck).findOneBy({ identityHash });
    if (existing && existing.userId !== userId) throw new ConflictException('Identity is already linked to another account');
    if (existing) return this.status(req);
    const proof = await this.provider.verify(dto.type, dto.number, dto.image);
    if (normalizeName(proof.firstName) !== normalizeName(user.firstName) || normalizeName(proof.lastName) !== normalizeName(user.lastName) || proof.dateOfBirth !== birthDate) throw new BadRequestException('Identity details do not match your profile');
    await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kyc:${userId}`]);
      const current = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!current?.isActive || current.isBlocked) throw new ForbiddenException('Account unavailable');
      if (normalizeName(proof.firstName) !== normalizeName(current.firstName ?? '') || normalizeName(proof.lastName) !== normalizeName(current.lastName ?? '')) throw new ConflictException('Profile changed during verification');
      if (current.dateOfBirth && identityDate(String(current.dateOfBirth)) !== birthDate) throw new BadRequestException('Identity birth date does not match your verified account');
      if (dto.type === 'nin' && current.kycTier < 1) throw new BadRequestException('BVN verification required');
      if (await manager.findOne(IdentityCheck, { where: { userId, type: dto.type } })) return;
      await manager.save(IdentityCheck, manager.create(IdentityCheck, { userId, type: dto.type, identityHash, lastDigits: dto.number.slice(-4), consentedAt: new Date(), evidence: { provider: 'prembly', ...proof } }));
      current.dateOfBirth = birthDate as unknown as Date;
      current.kycTier = Math.max(current.kycTier, dto.type === 'bvn' ? 1 : 2); current.kycStatus = 'approved';
      await manager.save(User, current);
    });
    return this.status(req);
  }
}
@Module({ imports: [AuthModule, TypeOrmModule.forFeature([IdentityCheck, User])], controllers: [KycController], providers: [PremblyProvider] })
export class KycModule {}
