import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_auth')
export class UserAuth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'pin_hash' })
  pinHash: string | null;

  @Column({ type: 'text', nullable: true, name: 'biometric_key' })
  biometricKey: string | null;

  @Column({ type: 'smallint', default: 0, name: 'failed_attempts' })
  failedAttempts: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'locked_until' })
  lockedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.auth)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
