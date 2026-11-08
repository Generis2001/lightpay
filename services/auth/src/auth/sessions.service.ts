import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { AuthSession } from './session.entity';
import { User } from '../users/user.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }

  private tokens(session: AuthSession) {
    const payload = { sub: session.userId, sessionId: session.id, deviceId: session.deviceId };
    const accessToken = this.jwt.sign({ ...payload, type: 'access', jti: randomUUID() }, {
      expiresIn: this.config.get('app.jwtExpiresIn') ?? '15m',
    });
    const refreshToken = this.jwt.sign({ ...payload, type: 'refresh', jti: randomUUID() }, {
      expiresIn: this.config.get('app.refreshTokenExpiresIn') ?? '30d',
    });
    const access = this.jwt.decode(accessToken) as { exp: number };
    const refresh = this.jwt.decode(refreshToken) as { exp: number };
    session.refreshHash = this.hash(refreshToken);
    session.expiresAt = new Date(refresh.exp * 1000);
    return { accessToken, refreshToken, expiresAt: new Date(access.exp * 1000).toISOString() };
  }

  async create(userId: string, deviceId?: string) {
    const session = this.sessions.create({ id: randomUUID(), userId, deviceId: deviceId ?? null });
    const tokens = this.tokens(session);
    await this.sessions.save(session);
    return tokens;
  }

  async validate(userId: string, sessionId: string) {
    const [session, user] = await Promise.all([
      this.sessions.findOne({ where: { id: sessionId, userId } }),
      this.users.findOne({ where: { id: userId } }),
    ]);
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !user?.isActive || user.isBlocked) {
      throw new UnauthorizedException('Session expired or revoked. Please sign in again.');
    }
    return user;
  }

  async refresh(token: string, deviceId?: string) {
    let payload: { type: string; sub: string; sessionId: string; deviceId?: string };
    try {
      payload = this.jwt.verify(token, { secret: this.config.getOrThrow<string>('app.jwtSecret') });
    } catch { throw new UnauthorizedException('Invalid refresh token'); }
    if (payload.type !== 'refresh' || !payload.sessionId || (payload.deviceId && payload.deviceId !== deviceId)) {
      throw new UnauthorizedException('Invalid refresh token or device');
    }
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user?.isActive || user.isBlocked) throw new UnauthorizedException('Account unavailable');
    const result = await this.sessions.manager.transaction(async (manager) => {
      const session = await manager.findOne(AuthSession, {
        where: { id: payload.sessionId, userId: payload.sub }, lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
      if (!timingSafeEqual(Buffer.from(session.refreshHash, 'hex'), Buffer.from(this.hash(token), 'hex'))) {
        // Commit revocation before rejecting a reused token.
        session.revokedAt = new Date();
        await manager.save(AuthSession, session);
        return null;
      }
      const tokens = this.tokens(session);
      await manager.save(AuthSession, session);
      return tokens;
    });
    if (!result) throw new UnauthorizedException('Refresh token expired, revoked or already used');
    return result;
  }

  async revoke(userId: string, sessionId: string) {
    await this.sessions.update({ id: sessionId, userId }, { revokedAt: new Date() });
  }
}
