import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { UserAuth } from './user-auth.entity';
import { UserDevice } from '../devices/device.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 15, nullable: true, unique: true })
  @Index()
  phone: string | null;

  @Column({ default: false, name: 'phone_verified' })
  phoneVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  @Index()
  email: string | null;

  @Column({ default: false, name: 'email_verified' })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'first_name' })
  firstName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'last_name' })
  lastName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  @Index()
  username: string | null;

  @Column({ type: 'text', nullable: true, name: 'avatar_url' })
  avatarUrl: string | null;

  @Column({ type: 'date', nullable: true, name: 'date_of_birth' })
  dateOfBirth: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string | null;

  @Column({ type: 'smallint', default: 0, name: 'kyc_tier' })
  kycTier: number;

  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'kyc_status' })
  kycStatus: string;

  @Column({ type: 'varchar', length: 11, nullable: true, unique: true })
  bvn: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true, unique: true })
  nin: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'is_blocked' })
  isBlocked: boolean;

  @Column({ type: 'text', nullable: true, name: 'blocked_reason' })
  blockedReason: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, unique: true, name: 'referral_code' })
  referralCode: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'referred_by' })
  referredBy: string | null;

  @Column({ type: 'varchar', length: 2, default: 'NG' })
  country: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date | null;

  @OneToOne(() => UserAuth, (auth) => auth.user)
  auth: UserAuth;

  @OneToMany(() => UserDevice, (device) => device.user)
  devices: UserDevice[];
}
