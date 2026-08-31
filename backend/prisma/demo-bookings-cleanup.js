// Removes the demo bookings created by demo-bookings-seed.js:
// deletes the bookings (and their photos), the demo notifications, the demo
// subscription if the seed created it, and reverses the credited earnings.
import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/prisma.js';

const MARKER_FILE = join(dirname(fileURLToPath(import.meta.url)), '.demo-bookings.json');

try {
  if (!fs.existsSync(MARKER_FILE)) {
    console.log('No demo bookings found (already cleaned up).');
  } else {
    const record = JSON.parse(fs.readFileSync(MARKER_FILE, 'utf8'));

    for (const id of record.booking_ids) {
      await prisma.servicePhoto.deleteMany({ where: { bookingId: id } });
      await prisma.booking.deleteMany({ where: { id } });
      await prisma.notification.deleteMany({ where: { message: { contains: `#${id}` } } });
    }

    if (record.subscription_id && record.subscription_created) {
      const remaining = await prisma.booking.count({ where: { subscriptionId: record.subscription_id } });
      if (remaining === 0) await prisma.userSubscription.deleteMany({ where: { id: record.subscription_id } });
    }

    if (record.earnings_credited && record.provider_id) {
      await prisma.provider.update({
        where: { id: record.provider_id },
        data: { earnings: { decrement: new Prisma.Decimal(record.earnings_credited) } },
      });
    }

    fs.unlinkSync(MARKER_FILE);
    console.log(`Removed demo bookings #${record.booking_ids.join(', #')}, demo notifications,${record.subscription_created ? ' demo subscription,' : ''} and reversed Rs.${record.earnings_credited} earnings.`);
  }
} catch (error) {
  console.error('Cleanup failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
