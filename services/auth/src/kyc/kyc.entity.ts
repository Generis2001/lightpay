import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
@Entity('identity_checks')
@Index(['userId', 'type'], { unique: true })
export class IdentityCheck {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 10 }) type!: string;
  @Column({ type: 'varchar', length: 64, unique: true, name: 'identity_hash' }) identityHash!: string;
  @Column({ type: 'varchar', length: 4, name: 'last_digits' }) lastDigits!: string;
  @Column({ type: 'jsonb', default: '{}' }) evidence!: Record<string, unknown>;
  @Column({ type: 'timestamptz', name: 'consented_at' }) consentedAt!: Date;
  @CreateDateColumn({ name: 'verified_at' }) verifiedAt!: Date;
}
