import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('payment_requests')
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 100, unique: true, name: 'request_key' }) requestKey!: string;
  @Column({ type: 'varchar', length: 100, unique: true }) reference!: string;
  @Column({ type: 'varchar', length: 64 }) fingerprint!: string;
}

@Entity('provider_customers')
export class ProviderCustomer {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id', unique: true }) userId!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) code!: string;
  @Column({ type: 'varchar', length: 255, name: 'customer_id', unique: true }) customerId!: string;
  @Column({ type: 'varchar', length: 255 }) email!: string;
}

@Entity('funding_intents')
export class FundingIntent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 100, unique: true }) reference!: string;
  @Index() @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'wallet_id' }) walletId!: string;
  @Column({ type: 'decimal', precision: 20, scale: 2 }) amount!: string;
  @Column({ type: 'varchar', length: 255 }) email!: string;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status!: string;
  @Column({ type: 'text', nullable: true, name: 'checkout_url' }) checkoutUrl!: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'transaction_id' }) transactionId!: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
