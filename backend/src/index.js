import { createApp } from './app.js';
import { PORT } from './config/env.js';
import { prisma } from './config/prisma.js';
import { closeRedisClient } from './middleware/rateLimit.js';
import { startRealtimeBus, stopRealtimeBus } from './services/realtime.js';
export { getAllowedOrigins, isOriginAllowed } from './app.js';

const service = process.env.LUXORA_SERVICE || 'all';
const app = await createApp({ service });
await startRealtimeBus({ receive: service === 'all' || service === 'engagement' });
const server = app.listen(PORT, () => console.log('Luxora %s listening on %s', service, PORT));
// Distributed deployments use externally scheduled jobs; no per-instance jobs.
if (service === 'all' && process.env.LUXORA_RUNTIME !== 'serverless') {
  const { startMonthlyPayoutScheduler } = await import('./services/payouts.js');
  const { startBookingTimeoutScheduler } = await import('./services/bookingTimeouts.js');
  const { renewDueDemoSubscriptions } = await import('./routes/services.js');
  // Seed a welcome promotion on first run (idempotent)
  prisma.promotion.count().then((c) => {
    if (c === 0) {
      return prisma.promotion.create({
        data: {
          title: 'Welcome to Luxora',
          description: '15% off your first subscription — a gift for joining the concierge network.',
          code: 'LUXORA15',
          discountPct: 15,
        },
      });
    }
  }).catch((err) => console.error('[startup] welcome promotion seed failed:', err.message));

  startMonthlyPayoutScheduler();
  startBookingTimeoutScheduler();
  setInterval(() => renewDueDemoSubscriptions().catch(error => console.error('[demo-renewal]', error.message)), 3600000).unref();
}
async function shutdown() {
  server.close(async () => {
    await stopRealtimeBus();
    await closeRedisClient();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
