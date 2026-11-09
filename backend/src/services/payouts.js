import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export function payoutPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

import { maskAccountNumber } from './bankingCrypto.js';
export { maskAccountNumber };

// Queue one payout per provider/month. Actual bank transfer confirmation is
// recorded by an admin or a future bank integration; the ledger is idempotent.
export async function queueMonthlyPayouts({ period = payoutPeriod(), client = prisma } = {}) {
  const providers = await client.provider.findMany({
    where: { earnings: { gt: 0 }, bankAccounts: { some: { selected: true } } },
    include: { bankAccounts: { where: { selected: true }, take: 1 } },
  });
  const queued = [];
  for (const provider of providers) {
    try {
      const payout = await client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(provider.id)})`;
        const fresh = await tx.provider.findUniqueOrThrow({ where: { id: provider.id }, include: { bankAccounts: { where: { selected: true }, take: 1 } } });
        const bankAccount = fresh.bankAccounts[0];
        if (!bankAccount) return null;
        const amount = new Prisma.Decimal(fresh.earnings || 0).toDecimalPlaces(2);
        if (amount.lte(0)) return null;
        const existing = await tx.providerPayout.findUnique({ where: { providerId_period: { providerId: provider.id, period } } });
        if (existing) return existing;
        await tx.provider.update({ where: { id: provider.id }, data: { earnings: { decrement: amount } } });
        return tx.providerPayout.create({
          data: {
            providerId: provider.id, bankAccountId: bankAccount.id, period, amount,
            idempotencyKey: `payout-${provider.id}-${period}-${crypto.randomUUID()}`,
            bankNameSnapshot: bankAccount.bankName,
            accountHolderSnapshot: bankAccount.accountHolder,
            accountNumberSnapshot: bankAccount.accountNumber,
            branchSnapshot: bankAccount.branch,
          },
        });
      }, { isolationLevel: 'Serializable' });
      if (payout) queued.push(payout);
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
    }
  }
  return queued;
}

export function startMonthlyPayoutScheduler({ now: getNow = () => new Date(), queue = queueMonthlyPayouts, schedule = setInterval } = {}) {
  if (String(process.env.PAYOUT_SCHEDULER_ENABLED || '').toLowerCase() !== 'true') return;
  let lastRun = '';
  let running = false;
  const tick = async () => {
    const now = getNow();
    const today = now.toISOString().slice(0, 10);
    // Run on the last day of every month: if tomorrow's UTC date is 1, today
    // is the last day of this month.  The old check `getUTCDate() !== 31`
    // silently skipped Feb, Apr, Jun, Sep, and Nov.
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    if (tomorrow.getUTCDate() !== 1 || lastRun === today || running) return;
    running = true;
    try {
      await queue({ period: payoutPeriod(now) });
      lastRun = today;
    }
    catch (error) { console.error('[payouts] monthly queue failed:', error.message); }
    finally { running = false; }
  };
  tick();
  const timer = schedule(tick, 60 * 60 * 1000);
  timer.unref();
  return timer;
}
