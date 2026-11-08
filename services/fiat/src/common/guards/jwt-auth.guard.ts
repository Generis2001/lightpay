import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: Record<string, unknown> }>();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('No token provided');

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>('app.jwtSecret'),
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const authUrl = this.configService.get<string>('app.authServiceUrl') ?? process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
    try {
      const { data } = await axios.get(`${authUrl}/api/v1/auth/session`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
      });
      if (data.data?.userId !== payload.sub || data.data?.sessionId !== payload.sessionId) {
        throw new UnauthorizedException('Invalid session');
      }
      request['user'] = { ...payload, kycTier: data.data.kycTier, kycStatus: data.data.kycStatus };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0))) {
        throw new UnauthorizedException('Session expired or revoked');
      }
      throw new ServiceUnavailableException('Unable to verify session. Please try again.');
    }
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token ?? null : null;
  }
}
