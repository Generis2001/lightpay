import { Module, Controller, Get, Post, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { successResponse } from '../common/response';
import { IsString, Matches } from 'class-validator';

class PushTokenDto {
  @IsString() @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/) token!: string;
}
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() async list(@Req() req: any) { return successResponse(await this.notifications.list(req.user.sub)); }
  @Post('read-all') async readAll(@Req() req: any) { await this.notifications.read(req.user.sub); return successResponse(null); }
  @Post(':id/read') async read(@Req() req: any, @Param('id') id: string) { await this.notifications.read(req.user.sub, id); return successResponse(null); }
  @Post('push/register') async register(@Req() req: any, @Body() dto: PushTokenDto) {
    if (!req.user.deviceId) throw new BadRequestException('Sign in again to register this device');
    await this.notifications.register(req.user.sub, req.user.deviceId, dto.token); return successResponse(null);
  }
  @Post('push/disable') async disable(@Req() req: any) { await this.notifications.disable(req.user.sub, req.user.deviceId); return successResponse(null); }
}
@Module({ imports: [JwtModule.register({})], controllers: [NotificationsController], providers: [NotificationsService, JwtAuthGuard] })
export class NotificationsModule {}
