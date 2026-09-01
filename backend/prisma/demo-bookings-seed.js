// Demo bookings for provider-dashboard testing.
// Creates one PENDING (claimable), one ASSIGNED (photo + PIN start/complete),
// and one COMPLETED (history + earnings) booking for the seeded demo provider.
// Removes all of it again with demo-bookings-cleanup.js.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';

const MARKER_FILE = join(dirname(fileURLToPath(import.meta.url)), '.demo-bookings.json');
const PAYOUT_RATE = 0.85;

const pinKey = crypto.createHash('sha256').update(JWT_SECRET).digest();
function encryptPin(pin) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', pinKey, iv);
  return Buffer.concat([iv, cipher.update(pin, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
}

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function makePins() {
  const startPin = crypto.randomInt(100000, 1000000).toString();
  const completionPin = crypto.randomInt(100000, 1000000).toString();
  return {
    startPin,
    completionPin,
    fields: {
      startPinHash: await bcrypt.hash(startPin, 12),
      completionPinHash: await bcrypt.hash(completionPin, 12),
      customerStartPinCipher: encryptPin(startPin),
      customerCompletionPinCipher: encryptPin(completionPin),
    },
  };
}

try {
  if (fs.existsSync(MARKER_FILE)) {
    console.error('Demo bookings already seeded. Run demo-bookings-cleanup.js first.');
    process.exit(1);
  }

  const customer = await prisma.user.findUnique({ where: { email: 'customer@luxora.lk' } });
  const providerUser = await prisma.user.findUnique({ where: { email: 'provider@luxora.lk' }, include: { provider: true } });
  const provider = providerUser?.provider;
  if (!customer || !provider) throw new Error('Demo customer/provider accounts not found. Run the main seed first.');

  const autoCare = await prisma.category.findUnique({ where: { name: 'Auto Care' } });
  const service = autoCare && await prisma.service.findFirst({ where: { categoryId: autoCare.id }, orderBy: { id: 'asc' } });
  if (!service) throw new Error('No active Auto Care service found.');

  // Membership so the demo bookings look consistent with a real subscription flow.
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { active: true, entitlements: { some: { categoryId: autoCare.id, units: { gt: 0 } } } },
    orderBy: { id: 'asc' },
  });
  let subscription = null;
  let subscriptionCreated = false;
  if (plan) {
    subscription = await prisma.userSubscription.findFirst({ where: { userId: customer.id, planId: plan.id, status: 'active' } });
    if (!subscription) {
      const planDetails = await prisma.subscriptionPlan.findUnique({ where: { id: plan.id }, include: { entitlements: true } });
      const endDate = new Date(Date.now() + 30 * 86400000);
      subscription = await prisma.userSubscription.create({
        data: {
          userId: customer.id,
          planId: plan.id,
          planTitle: planDetails?.title || 'Auto Care Package',
          planType: planDetails?.type || 'Auto Care',
          pricePaid: planDetails?.priceMonthly || 12000,
          durationDays: 30,
          endDate,
          status: 'active',
          renewalIntervalDays: 30,
          nextRenewalDate: endDate,
          entitlements: {
            create: (planDetails?.entitlements || []).map((e) => ({
              categoryId: e.categoryId,
              units: e.units,
            })),
          },
        },
      });
      subscriptionCreated = true;
    }
  }

  const base = {
    userId: customer.id,
    serviceId: service.id,
    subscriptionId: subscription?.id ?? null,
    town: 'Colombo',
    totalPrice: service.price,
  };

  // 1) PENDING — claimable from the provider dashboard
  const pendingPins = await makePins();
  const pending = await prisma.booking.create({
    data: {
      ...base,
      ...pendingPins.fields,
      bookingDate: isoDate(3),
      bookingTime: '10:00',
      status: 'PENDING',
      pinExpiresAt: new Date(new Date(`${isoDate(3)}T10:00:00`).getTime() + 24 * 3600 * 1000),
    },
  });

  // 2) ASSIGNED — for before-photo upload + PIN start / after-photo + PIN complete
  const assignedPins = await makePins();
  const assigned = await prisma.booking.create({
    data: {
      ...base,
      ...assignedPins.fields,
      providerId: provider.id,
      bookingDate: isoDate(1),
      bookingTime: '10:00',
      status: 'ASSIGNED',
      autoAssigned: true,
      pinExpiresAt: new Date(new Date(`${isoDate(1)}T10:00:00`).getTime() + 24 * 3600 * 1000),
    },
  });

  // 3) COMPLETED — shows in History with earnings
  const payout = new Prisma.Decimal(service.price).mul(PAYOUT_RATE).toDecimalPlaces(2);
  const completed = await prisma.booking.create({
    data: {
      ...base,
      providerId: provider.id,
      bookingDate: isoDate(-2),
      bookingTime: '14:00',
      status: 'COMPLETED',
      startPinUsedAt: new Date(Date.now() - 2 * 86400000),
      completionPinUsedAt: new Date(Date.now() - 2 * 86400000 + 3600000),
    },
  });
  await prisma.provider.update({ where: { id: provider.id }, data: { earnings: { increment: payout } } });

  // Demo notifications so the bell has content
  await prisma.notification.createMany({
    data: [
      { userId: providerUser.id, message: `New claimable booking: ${service.title} on ${isoDate(3)} at 10:00.` },
      { userId: providerUser.id, message: `Booking #${assigned.id} was assigned to you (${isoDate(1)} at 10:00).` },
      { userId: providerUser.id, message: `Payment received for booking #${completed.id}.` },
    ],
  });

  const record = {
    created_at: new Date().toISOString(),
    booking_ids: [pending.id, assigned.id, completed.id],
    provider_id: provider.id,
    provider_user_id: providerUser.id,
    subscription_id: subscription?.id ?? null,
    subscription_created: subscriptionCreated,
    earnings_credited: payout.toString(),
  };
  fs.writeFileSync(MARKER_FILE, JSON.stringify(record, null, 2));

  console.log('Demo bookings created:');
  console.log(`  PENDING   #${pending.id} — ${service.title} on ${isoDate(3)} 10:00`);
  console.log(`  ASSIGNED  #${assigned.id} — ${service.title} on ${isoDate(1)} 10:00`);
  console.log(`  COMPLETED #${completed.id} — ${service.title} on ${isoDate(-2)} 14:00 (earnings +Rs.${payout})`);
  console.log('\nPINs for testing the provider dashboard flow:');
  console.log(`  #${pending.id} (pending)  — start PIN: ${pendingPins.startPin} | completion PIN: ${pendingPins.completionPin}`);
  console.log(`  #${assigned.id} (assigned) — start PIN: ${assignedPins.startPin} | completion PIN: ${assignedPins.completionPin}`);
  console.log('\nCleanup later with: node prisma/demo-bookings-cleanup.js');
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
