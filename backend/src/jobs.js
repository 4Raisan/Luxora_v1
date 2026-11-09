import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { prisma } from './config/prisma.js';
import { getRedisClient, closeRedisClient } from './middleware/rateLimit.js';
import { startRealtimeBus, stopRealtimeBus } from './services/realtime.js';
import { processExpiredBookings } from './services/bookingTimeouts.js';
import { queueMonthlyPayouts } from './services/payouts.js';
import { renewDueDemoSubscriptions } from './routes/services.js';
import { runTaskScope } from './runtime/tasks.js';

export function monthlyPeriod(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [year, month, day] = date.split('-').map(Number);
  return day === new Date(Date.UTC(year, month, 0)).getUTCDate() ? date.slice(0, 7) : null;
}

export async function runJob(name, { now = new Date(), redis = getRedisClient(), handlers = {
  'booking-timeouts': () => processExpiredBookings(),
  'demo-renewals': () => renewDueDemoSubscriptions(),
  'monthly-payouts': () => {
    const period = monthlyPeriod(now);
    return period ? queueMonthlyPayouts({ period }) : [];
  },
} } = {}) {
  if (!Object.hasOwn(handlers, name)) throw new Error(`Unknown job: ${name}`);
  if (!redis && process.env.LUXORA_RUNTIME === 'serverless') throw new Error('Scheduled jobs require shared Redis leases');
  const lock = `luxora:jobs:${name}`;
  const owner = crypto.randomUUID();
  if (redis && await redis.set(lock, owner, 'EX', 900, 'NX') !== 'OK') return { skipped: true };
  try {
    return await runTaskScope(() => handlers[name]());
  } finally {
    if (redis) await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, lock, owner);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await startRealtimeBus();
    await runJob(process.argv[2]);
    console.info('[job] completed:', process.argv[2]);
  } catch (error) {
    console.error('[job] failed:', error.message);
    process.exitCode = 1;
  } finally {
    await stopRealtimeBus();
    await closeRedisClient();
    await prisma.$disconnect();
  }
}
