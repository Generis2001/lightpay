import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryColumn('uuid') id!: string;
  @Index() @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'device_id' }) deviceId!: string | null;
  @Column({ type: 'varchar', length: 64, name: 'refresh_hash' }) refreshHash!: string;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true, name: 'revoked_at' }) revokedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
