import { v4 as uuidv4 } from 'uuid';

export function generateReference(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `LP${prefix}-${timestamp}-${random}`;
}

export function formatAmount(amount: string | number): number {
  return typeof amount === 'string' ? parseFloat(amount) : amount;
}
