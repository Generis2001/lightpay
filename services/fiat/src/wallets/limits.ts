import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Decimal } from 'decimal.js';

export const TIER_LIMITS = [
  { daily: 20000, perTransaction: 20000, balance: 100000 },
  { daily: 1000000, perTransaction: 1000000, balance: null },
  { daily: 10000000, perTransaction: 1000000, balance: null },
] as const;

export async function getVerifiedTier(manager: EntityManager, userId: string) {
  const [user] = await manager.query('SELECT kyc_tier, kyc_status, is_active, is_blocked FROM auth.users WHERE id = $1', [userId]);
  if (!user?.is_active || user.is_blocked) throw new ForbiddenException('Account unavailable');
  return user.kyc_status === 'approved' ? Math.max(0, Math.min(2, Number(user.kyc_tier) || 0)) : 0;
}

export async function paymentLimits(manager: EntityManager, userId: string) {
  const tier = await getVerifiedTier(manager, userId);
  const limits = TIER_LIMITS[tier]!;
  // Calendar day is Africa/Lagos, independently of the database server timezone.
  const [spend] = await manager.query(`SELECT COALESCE(SUM(amount + fee), 0) AS total FROM fiat.transactions
    WHERE user_id = $1 AND type IN ('transfer_out', 'airtime', 'data', 'electricity', 'cable')
    AND status IN ('pending', 'processing', 'completed')
    AND created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos')`, [userId]);
  return { tier, dailyLimit: limits.daily, perTransactionLimit: limits.perTransaction, balanceLimit: limits.balance,
    spentToday: Number(spend.total), remainingToday: Math.max(0, limits.daily - Number(spend.total)), timezone: 'Africa/Lagos' };
}

export async function enforceSpend(manager: EntityManager, userId: string, amount: Decimal) {
  // Serialize outgoing requests across every wallet and device for this user.
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`spend:${userId}`]);
  const limits = await paymentLimits(manager, userId);
  if (amount.gt(limits.perTransactionLimit) || amount.gt(limits.remainingToday)) {
    throw new BadRequestException({ code: 'TRANSACTION_LIMIT', message: `This payment exceeds your limit. NGN ${limits.remainingToday.toLocaleString('en-NG')} remains today.` });
  }
}
