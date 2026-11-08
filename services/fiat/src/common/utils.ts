import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export function generateReference(prefix: string, idempotencyKey?: string): string {
  if (idempotencyKey) return `lp${prefix.toLowerCase()}-${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 40)}`;
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `lp${prefix}-${timestamp}-${random}`.toLowerCase();
}

export function requestFingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

export function vtpassReference() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}${part('month')}${part('day')}${part('hour')}${part('minute')}${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

export function formatAmount(amount: string | number): number {
  return typeof amount === 'string' ? parseFloat(amount) : amount;
}
