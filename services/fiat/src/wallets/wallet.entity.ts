import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';
import { Transaction } from '../transactions/transaction.entity';
import { VirtualAccount } from './virtual-account.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  balance: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0, name: 'ledger_balance' })
  ledgerBalance: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Transaction, (tx) => tx.wallet)
  transactions: Transaction[];

  @OneToOne(() => VirtualAccount, (va) => va.wallet)
  virtualAccount: VirtualAccount;
}
