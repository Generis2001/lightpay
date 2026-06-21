import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'beneficiaries', schema: 'fiat' })
@Index(['userId', 'type', 'accountNumber'], { unique: true })
export class Beneficiary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: 'bank' | 'internal';

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, name: 'bank_code', nullable: true })
  bankCode: string | null;

  @Column({ type: 'varchar', length: 100, name: 'bank_name', nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 20, name: 'account_number' })
  accountNumber: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'last_amount', nullable: true })
  lastAmount: string | null;

  @Column({ type: 'int', default: 0, name: 'times_used' })
  timesUsed: number;

  @Column({ type: 'boolean', default: false, name: 'is_favourite' })
  isFavourite: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
