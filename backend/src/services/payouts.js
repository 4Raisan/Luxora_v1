import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export function payoutPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function maskAccountNumber(value) {
  const digits = String(value || '');
  return digits.length <= 4 ? digits : `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

// Queue one payout per provider/month. Actual bank transfer confirmation is
// recorded by an admin or a future bank integration; the ledger is idempotent.
export async function queueMonthlyPayouts({ period = payoutPeriod(), client = prisma } = {}) {
  const providers = await client.provider.findMany({
    where: { earnings: { gt: 0 }, bankAccounts: { some: { selected: true } } },
    include: { bankAccounts: { where: { selected: true }, take: 1 } },
  });
  const queued = [];
  for (const provider of providers) {
    const bankAccount = provider.bankAccounts[0];
    if (!bankAccount) continue;
    try {
      const payout = await client.$transaction(async (tx) => {
        const fresh = await tx.provider.findUniqueOrThrow({ where: { id: provider.id }, select: { earnings: true } });
        const amount = new Prisma.Decimal(fresh.earnings || 0).toDecimalPlaces(2);
        if (amount.lte(0)) return null;
        const existing = await tx.providerPayout.findUnique({ where: { providerId_period: { providerId: provider.id, period } } });
        if (existing) return existing;
        await tx.provider.update({ where: { id: provider.id }, data: { earnings: { decrement: amount } } });
        return tx.providerPayout.create({
          data: { providerId: provider.id, bankAccountId: bankAccount.id, period, amount, idempotencyKey: `payout-${provider.id}-${period}-${crypto.randomUUID()}` },
        });
      }, { isolationLevel: 'Serializable' });
      if (payout) queued.push(payout);
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
    }
  }
  return queued;
}

export function startMonthlyPayoutScheduler() {
  if (String(process.env.PAYOUT_SCHEDULER_ENABLED || '').toLowerCase() !== 'true') return;
  let lastRun = '';
  const tick = async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // Run on the last day of every month: if tomorrow's UTC date is 1, today
    // is the last day of this month.  The old check `getUTCDate() !== 31`
    // silently skipped Feb, Apr, Jun, Sep, and Nov.
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    if (tomorrow.getUTCDate() !== 1 || lastRun === today) return;
    lastRun = today;
    try { await queueMonthlyPayouts(); }
    catch (error) { console.error('[payouts] monthly queue failed:', error.message); }
  };
  tick();
  setInterval(tick, 60 * 60 * 1000).unref();
}
