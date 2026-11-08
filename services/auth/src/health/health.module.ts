import { Module, Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}
  @Get() async health() {
    try { await this.db.query('SELECT 1'); return { status: 'ready' }; }
    catch { throw new ServiceUnavailableException('Database unavailable'); }
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
