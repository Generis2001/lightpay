import { EntityManager } from 'typeorm';
import { Notification, PushDevice, PushDelivery } from './notification.entity';
import { Transaction } from '../transactions/transaction.entity';

// Notifications and their delivery jobs commit with the corresponding ledger event.
export async function notifyTransaction(manager: EntityManager, tx: Transaction) {
  const incoming = ['credit', 'transfer_in', 'crypto_in'].includes(tx.type);
  const reversed = tx.status === 'reversed';
  const notification = await manager.save(Notification, manager.create(Notification, {
    userId: tx.userId, eventKey: `${tx.reference}:${tx.status}`, type: incoming || reversed ? 'credit' : 'debit',
    title: reversed ? 'Payment refunded' : incoming ? 'Money received' : tx.status === 'completed' ? 'Payment completed' : tx.status === 'failed' ? 'Payment failed' : 'Payment processing',
    body: `${tx.currency} ${tx.amount} · ${tx.description ?? tx.reference}`,
    metadata: { transactionId: tx.id, reference: tx.reference, status: tx.status },
  }));
  const devices = await manager.find(PushDevice, { where: { userId: tx.userId, enabled: true } });
  for (const device of devices) await manager.save(PushDelivery, manager.create(PushDelivery, {
    notificationId: notification.id, deviceId: device.id,
  }));
}
