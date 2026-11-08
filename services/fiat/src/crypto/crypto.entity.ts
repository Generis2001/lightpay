import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('crypto_accounts')
export class CryptoAccount {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id', unique: true }) userId!: string;
  @Column({ type: 'varchar', length: 100, name: 'vault_id', unique: true }) vaultId!: string;
}
@Entity('crypto_addresses')
@Index(['userId', 'symbol', 'network'], { unique: true })
export class CryptoAddress {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'wallet_id', unique: true }) walletId!: string;
  @Column({ type: 'varchar', length: 10 }) symbol!: string;
  @Column({ type: 'varchar', length: 50 }) network!: string;
  @Column({ type: 'varchar', length: 100, name: 'asset_id' }) assetId!: string;
  @Column({ type: 'varchar', length: 255 }) address!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) tag!: string | null;
}
@Entity('crypto_quotes')
export class CryptoQuote {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'wallet_id' }) walletId!: string;
  @Column({ type: 'varchar', length: 10 }) symbol!: string;
  @Column({ type: 'varchar', length: 50 }) network!: string;
  @Column({ type: 'varchar', length: 255 }) address!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) tag!: string | null;
  @Column({ type: 'numeric', precision: 38, scale: 18 }) amount!: string;
  @Column({ type: 'numeric', precision: 38, scale: 18, name: 'estimated_fee' }) estimatedFee!: string;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt!: Date;
  @Column({ type: 'uuid', nullable: true, name: 'transaction_id' }) transactionId!: string | null;
}
