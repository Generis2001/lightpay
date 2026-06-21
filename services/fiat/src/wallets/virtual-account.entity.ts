import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Wallet } from './wallet.entity';

@Entity('virtual_accounts')
export class VirtualAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'uuid', name: 'wallet_id' })
  walletId: string;

  @Column({ type: 'varchar', length: 10, unique: true, name: 'account_number' })
  @Index()
  accountNumber: string;

  @Column({ type: 'varchar', length: 100, name: 'bank_name' })
  bankName: string;

  @Column({ type: 'varchar', length: 10, name: 'bank_code' })
  bankCode: string;

  @Column({ type: 'varchar', length: 255, name: 'account_name' })
  accountName: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'provider_ref' })
  providerRef: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne(() => Wallet, (wallet) => wallet.virtualAccount)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}
