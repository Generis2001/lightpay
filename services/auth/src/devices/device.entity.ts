import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_devices')
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255, name: 'device_id' })
  deviceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'device_name' })
  deviceName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  platform: string | null;

  @Column({ type: 'text', nullable: true, name: 'push_token' })
  pushToken: string | null;

  @Column({ type: 'varchar', length: 255, name: 'fingerprint' })
  fingerprint: string;

  @Column({ default: false, name: 'is_trusted' })
  isTrusted: boolean;

  @Column({ default: false, name: 'biometric_enabled' })
  biometricEnabled: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_seen_at' })
  lastSeenAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.devices)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
