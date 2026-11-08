import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SessionsService } from './sessions.service';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  deviceId?: string;
  sessionId?: string;
  type?: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService, private readonly sessions: SessionsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('app.jwtSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access' || !payload.sessionId || !payload.sub) {
      throw new UnauthorizedException('Refresh token cannot be used as access token');
    }
    const user = await this.sessions.validate(payload.sub, payload.sessionId);
    return {
      kycTier: user.kycTier, kycStatus: user.kycStatus,
      sub: payload.sub,
      deviceId: payload.deviceId,
      sessionId: payload.sessionId,
    };
  }
}
