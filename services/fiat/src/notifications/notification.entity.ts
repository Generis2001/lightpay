import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 150, unique: true, name: 'event_key' }) eventKey!: string;
  @Column({ type: 'varchar', length: 30 }) type!: string;
  @Column({ type: 'varchar', length: 255 }) title!: string;
  @Column({ type: 'text' }) body!: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata!: Record<string, unknown>;
  @Column({ type: 'boolean', default: false, name: 'is_read' }) isRead!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}

@Entity('push_devices')
@Index(['userId', 'deviceId'], { unique: true })
export class PushDevice {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 255, name: 'device_id' }) deviceId!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) token!: string;
  @Column({ type: 'boolean', default: true }) enabled!: boolean;
}

@Entity('push_deliveries')
@Index(['notificationId', 'deviceId'], { unique: true })
export class PushDelivery {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'notification_id' }) notificationId!: string;
  @Column({ type: 'uuid', name: 'device_id' }) deviceId!: string;
  @Column({ type: 'int', default: 0 }) attempts!: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP', name: 'next_attempt_at' }) nextAttemptAt!: Date;
  @Column({ type: 'timestamptz', nullable: true, name: 'sent_at' }) sentAt!: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'ticket_id' }) ticketId!: string | null;
}
