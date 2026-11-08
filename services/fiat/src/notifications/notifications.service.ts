import { Injectable, OnModuleInit, OnModuleDestroy, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, LessThanOrEqual } from 'typeorm';
import axios from 'axios';
import { Notification, PushDevice, PushDelivery } from './notification.entity';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: DataSource) {}
  onModuleInit() { this.timer = setInterval(() => { void this.deliver(); }, 30000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  list(userId: string) { return this.db.getRepository(Notification).find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }); }
  async read(userId: string, id?: string) {
    const result = await this.db.getRepository(Notification).update(id ? { id, userId } : { userId }, { isRead: true });
    if (id && !result.affected) throw new NotFoundException('Notification not found');
  }
  async register(userId: string, deviceId: string, token: string) {
    await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`push:${token}`]);
      // A token belongs to the currently signed-in user on this installation.
      await manager.delete(PushDevice, { token });
      await manager.delete(PushDevice, { userId, deviceId });
      await manager.save(PushDevice, manager.create(PushDevice, { userId, deviceId, token, enabled: true }));
    });
  }
  async disable(userId: string, deviceId: string) { await this.db.getRepository(PushDevice).update({ userId, deviceId }, { enabled: false }); }
  async deliver() {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.db.getRepository(PushDelivery).find({ where: { sentAt: IsNull(), nextAttemptAt: LessThanOrEqual(new Date()) }, take: 20 });
      for (const job of jobs) await this.db.transaction(async (manager) => {
        const current = await manager.findOne(PushDelivery, { where: { id: job.id }, lock: { mode: 'pessimistic_write' } });
        if (!current || current.sentAt || current.attempts >= 8 || current.nextAttemptAt > new Date()) return;
        const device = await manager.findOne(PushDevice, { where: { id: current.deviceId, enabled: true } });
        const notification = await manager.findOne(Notification, { where: { id: current.notificationId } });
        const [session] = device ? await manager.query(`SELECT EXISTS (
          SELECT 1 FROM auth.auth_sessions s JOIN auth.users u ON u.id = s.user_id
          WHERE s.user_id = $1 AND s.device_id = $2 AND s.revoked_at IS NULL
          AND s.expires_at > NOW() AND u.is_active AND NOT u.is_blocked
        ) AS active`, [device.userId, device.deviceId]) : [{ active: false }];
        current.attempts++;
        if (!device || !notification || !session.active || device.userId !== notification.userId) { current.sentAt = new Date(); }
        else try {
          const { data } = await axios.post('https://exp.host/--/api/v2/push/send', {
            to: device.token, title: notification.title, body: notification.body, data: notification.metadata, sound: 'default', channelId: 'payments',
          }, { timeout: 10000, headers: process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {} });
          if (data.data?.status === 'ok') { current.sentAt = new Date(); current.ticketId = data.data.id; }
          else if (data.data?.details?.error === 'DeviceNotRegistered') {
            device.enabled = false; await manager.save(PushDevice, device); current.sentAt = new Date();
          }
        } catch { /* Persist backoff; provider or network failure must not affect a payment. */ }
        current.nextAttemptAt = new Date(Date.now() + Math.min(3600000, 30000 * 2 ** current.attempts));
        await manager.save(PushDelivery, current);
      });
    } catch { /* Next interval retries; no customer data is logged. */ }
    finally { this.running = false; }
  }
}
