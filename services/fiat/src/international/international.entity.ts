import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('international_quotes')
export class InternationalQuote {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'jsonb' }) request!: Record<string, any>;
  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'source_amount' }) sourceAmount!: string;
  @Column({ type: 'decimal', precision: 20, scale: 2 }) fee!: string;
  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'destination_amount' }) destinationAmount!: string;
  @Column({ type: 'varchar', length: 10, name: 'destination_currency' }) destinationCurrency!: string;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt!: Date;
  @Column({ type: 'uuid', nullable: true, name: 'transaction_id' }) transactionId!: string | null;
}
