import { Module, Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}
  @Get() async health() {
    const services = this.config.getOrThrow<{ auth: string; fiat: string }>('app.services');
    const checks = await Promise.allSettled([
      fetch(`${services.auth}/api/v1/health`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${services.fiat}/health`, { signal: AbortSignal.timeout(5000) }),
    ]);
    if (checks.some((check) => check.status !== 'fulfilled' || !check.value.ok)) throw new ServiceUnavailableException('A required service is unavailable');
    return { status: 'ready' };
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
