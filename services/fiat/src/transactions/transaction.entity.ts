import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Wallet } from '../wallets/wallet.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  reference: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'uuid', name: 'wallet_id' })
  @Index()
  walletId: string;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  @Index()
  status: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  fee: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'balance_before' })
  balanceBefore: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'balance_after' })
  balanceAfter: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  narration: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'provider_ref' })
  providerRef: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'provider_status' })
  providerStatus: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  channel: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'device_id' })
  deviceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}
