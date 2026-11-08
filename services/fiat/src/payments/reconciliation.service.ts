import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { PaymentsService } from './payments.service';
import { BillsService } from '../bills/bills.service';
import { TransfersService } from '../transfers/transfers.service';
import { Transaction } from '../transactions/transaction.entity';

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: DataSource, private readonly payments: PaymentsService, private readonly bills: BillsService, private readonly transfers: TransfersService) {}
  onModuleInit() { this.timer = setInterval(() => { void this.reconcile(); }, 30000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async reconcile() {
    if (this.running) return;
    this.running = true;
    const runner = this.db.createQueryRunner();
    let acquired = false;
    try {
      await runner.connect();
      const [lock] = await runner.query("SELECT pg_try_advisory_lock(hashtext('lightpay:reconciliation')) AS acquired");
      acquired = lock.acquired;
      if (!acquired) return;
      const transactions = await this.db.getRepository(Transaction).find({ where: { status: In(['pending', 'processing']), provider: In(['paystack', 'vtpass']) }, take: 50, order: { updatedAt: 'ASC' } });
      for (const tx of transactions) {
        try {
          if (tx.provider === 'paystack') {
            await this.transfers.resume(tx);
            await this.payments.settleTransfer(tx.reference);
          } else await this.bills.reconcile(tx);
        } catch { /* Unknown outcomes remain processing and are retried, without issuing a refund. */ }
        await this.db.getRepository(Transaction).update(tx.id, { updatedAt: new Date() });
      }
    } catch { /* Provider/database outages are retried on the next interval. */ }
    finally {
      if (acquired) await runner.query("SELECT pg_advisory_unlock(hashtext('lightpay:reconciliation'))").catch(() => {});
      await runner.release(); this.running = false;
    }
  }
}
