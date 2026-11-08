import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('otp_challenges')
export class OtpChallenge {
  @PrimaryColumn({ type: 'varchar', length: 64 }) key!: string;
  @Column({ type: 'varchar', length: 64, name: 'code_hash' }) codeHash!: string;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt!: Date;
  @Column({ type: 'smallint', default: 0 }) attempts!: number;
  @Column({ type: 'timestamptz', nullable: true, name: 'used_at' }) usedAt!: Date | null;
}
