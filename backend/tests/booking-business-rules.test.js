import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { stopChildProcess } from './helpers/stop-child-process.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import { getEntitlementSnapshot } from '../src/services/entitlements.js';
import {
  isInAutoAssignmentWindow,
  meetsLeadTimeHours,
} from '../src/services/scheduling.js';
import { processExpiredBookings } from '../src/services/bookingTimeouts.js';
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5035;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RND = crypto.randomUUID().slice(0, 8);

const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'demo',
  RESEND_API_KEY: '',
  GOOGLE_CLIENT_ID: '',
};

let server;
const json = async (apiPath, options = {}) => {
  const response = await fetch(`${BASE}${apiPath}`, { ...options, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, text };
};
const authJson = (token, apiPath, options = {}) => json(apiPath, {
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
  },
});

const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const timeStr = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const plusMs = (ms) => new Date(Date.now() + ms);
// Tomorrow at a fixed in-window hour: always >4h out regardless of the
// current time of day, and always inside 07:00-16:00 for auto-assignment.
const tomorrowAt = (hh, mm) => {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return { date: dateStr(d), time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
};
const quarterFloor = (d) => {
  const c = new Date(d);
  c.setMinutes(Math.floor(c.getMinutes() / 15) * 15, 0, 0);
  return c;
};

async function mkUser(role, town, district, suffix) {
  return prisma.user.create({
    data: {
      name: `BRule ${role} ${suffix}`,
      email: `brule.${role.toLowerCase()}.${suffix}@test.luxora`,
      passwordHash: await bcrypt.hash('pass123', 10),
      role,
      town,
      addressDistrict: district,
      active: true,
    },
  });
}
const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET);

let fixtures;
async function makeFixtures() {
  const category = await prisma.category.create({ data: { name: `BRuleCat_${RND}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, title: `BRule Service ${RND}`, price: 5000, providerEarning: 3000, durationMins: 60 },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `BRule Plan ${RND}`, type: 'Auto Care', priceMonthly: 9000, durationDays: 30,
      features: '[]', entitlements: { create: [{ categoryId: category.id, units: 10 }] },
    },
  });
  return { category, service, plan };
}
async function giveSubscription(userId) {
  return prisma.userSubscription.create({
    data: { userId, planId: fixtures.plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });
}
async function mkProvider(town, district, suffix) {
  const user = await mkUser('PROVIDER', town, district, suffix);
  const provider = await prisma.provider.create({
    data: { userId: user.id, category: fixtures.category.name, serviceTowns: town, kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  return { user, provider, token: tokenFor(user) };
}
async function remainingUnits(customerId, categoryId) {
  const snap = await getEntitlementSnapshot(prisma, customerId);
  return snap.find((s) => s.category_id === categoryId)?.remaining_units ?? null;
}

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: 'ignore' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (attempt === 59) throw new Error('Test server failed to start');
  }
  fixtures = await makeFixtures();
  // Pin the rules under test: window 07:00-16:00, cooldown 5h (other suites
  // may run before/after this file in the shared test schema).
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = tokenFor(admin);
  const settings = await authJson(adminToken, '/admin/settings/scheduling', {
    method: 'PUT',
    body: JSON.stringify({ auto_assignment_cooldown_hours: 5, auto_assignment_start_hour: 7, auto_assignment_end_hour: 16 }),
  });
  assert.equal(settings.status, 200);
  assert.equal(settings.body.autoAssignmentCooldownHours, 5);
  assert.equal(settings.body.autoAssignmentStartHour, 7);
  assert.equal(settings.body.autoAssignmentEndHour, 16);
});

after(async () => {
  await stopChildProcess(server);
  await prisma.$disconnect();
});

// ---------- BOOKING CREATION LEAD TIME ----------

test('Creation: slot clearly beyond 4h is allowed; slot within 4h is rejected (server-side)', async () => {
  const town = `BRule Town C1 ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `c1${RND}`);
  await giveSubscription(cust.id);
  const token = tokenFor(cust);

  const okSlot = quarterFloor(plusMs(6 * 3600 * 1000));
  const okRes = await authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: dateStr(okSlot), booking_time: timeStr(okSlot) }),
  });
  assert.equal(okRes.status, 201, okRes.text);

  const nearSlot = quarterFloor(plusMs(2 * 3600 * 1000));
  const nearRes = await authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: dateStr(nearSlot), booking_time: timeStr(nearSlot) }),
  });
  assert.equal(nearRes.status, 400, nearRes.text);
  assert.match(nearRes.body.error, /at least 4 hours/i);
});

test('Creation: exact 4h boundary allowed, 4h minus 1s rejected (unit-level, TZ-portable)', async () => {
  // Fixed Colombo wall slot 14:00; instants chosen so the Colombo-frame
  // difference is exactly 4h / 4h-minus-1s. Holds under any server TZ.
  assert.equal(meetsLeadTimeHours('2026-09-10', '14:00', 4, new Date('2026-09-10T04:30:00.000Z')), true);
  assert.equal(meetsLeadTimeHours('2026-09-10', '14:00', 4, new Date('2026-09-10T04:30:01.000Z')), false);
  // HTTP-level margins around the same boundary (avoids ms race flake).
  const town = `BRule Town C1b ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `c1b${RND}`);
  await giveSubscription(cust.id);
  const token = tokenFor(cust);
  const mkSlot = (ms) => {
    const d = new Date(Date.now() + ms);
    d.setSeconds(0, 0);
    return d;
  };
  const over = mkSlot(4 * 3600 * 1000 + 8 * 60 * 1000);
  over.setMinutes(Math.ceil(over.getMinutes() / 15) * 15 % 60);
  const overRes = await authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: dateStr(over), booking_time: timeStr(over) }),
  });
  assert.equal(overRes.status, 201, overRes.text);
  const under = mkSlot(4 * 3600 * 1000 - 8 * 60 * 1000);
  under.setMinutes(Math.floor(under.getMinutes() / 15) * 15);
  const underRes = await authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: dateStr(under), booking_time: timeStr(under) }),
  });
  assert.equal(underRes.status, 400, underRes.text);
});

// ---------- RESCHEDULE ----------

test('Reschedule: new slot under 4h rejected; far slot succeeds once with net-zero coins', async () => {
  const town = `BRule Town R1 ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `r1${RND}`);
  await giveSubscription(cust.id);
  const token = tokenFor(cust);
  const far = quarterFloor(plusMs(30 * 3600 * 1000));
  const created = await authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: dateStr(far), booking_time: timeStr(far), pet_type: 'dog' }),
  });
  assert.equal(created.status, 201, created.text);

  const near = quarterFloor(plusMs(2 * 3600 * 1000));
  const bad = await authJson(token, `/bookings/${created.body.booking_id}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ booking_date: dateStr(near), booking_time: timeStr(near), reason: 'too soon test', confirmed: true }),
  });
  assert.equal(bad.status, 400, bad.text);
  assert.match(bad.body.error, /at least 4 hours/i);

  const far2 = quarterFloor(plusMs(50 * 3600 * 1000));
  const good = await authJson(token, `/bookings/${created.body.booking_id}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ booking_date: dateStr(far2), booking_time: timeStr(far2), reason: 'need later slot', confirmed: true }),
  });
  assert.equal(good.status, 200, good.text);
  const oldB = await prisma.booking.findUnique({ where: { id: created.body.booking_id } });
  assert.equal(oldB.status, 'CANCELLED');
  const newB = await prisma.booking.findUnique({ where: { id: good.body.id } });
  assert.equal(newB.petType, 'dog');
  assert.equal(newB.subscriptionId, oldB.subscriptionId);
  // Net-zero: exactly one active booking consumes the entitlement.
  const snap = await getEntitlementSnapshot(prisma, cust.id);
  const row = snap.find((s) => s.category_id === fixtures.category.id);
  assert.equal(row.used_units, 1);
  // Repeat reschedule of the cancelled old booking is rejected (idempotent).
  const repeat = await authJson(token, `/bookings/${created.body.booking_id}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ booking_date: dateStr(far2), booking_time: timeStr(far2), reason: 'again', confirmed: true }),
  });
  assert.ok([404, 409].includes(repeat.status), repeat.text);
});

// ---------- CUSTOMER CANCEL ----------

test('Customer cancel: PENDING and ASSIGNED restore the coin; IN_PROGRESS/COMPLETED rejected; repeat is safe', async () => {
  const town = `BRule Town CC ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `cc${RND}`);
  await giveSubscription(cust.id);
  const token = tokenFor(cust);
  const { provider } = await mkProvider(town, 'Western', `ccp${RND}`);

  const full = await remainingUnits(cust.id, fixtures.category.id);
  // PENDING booking (provider temporarily offline so nothing auto-assigns).
  await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: 'offline' } });
  const slot = tomorrowAt(9, 0);
  const pending = await authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: slot.date, booking_time: slot.time }),
  });
  assert.equal(pending.status, 201, pending.text);
  assert.equal(pending.body.status, 'pending');
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 1);
  const cancelPending = await authJson(token, `/bookings/${pending.body.booking_id}/cancel`, { method: 'PUT' });
  assert.equal(cancelPending.status, 200, cancelPending.text);
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full, 'coin restored exactly once');
  const repeatPending = await authJson(token, `/bookings/${pending.body.booking_id}/cancel`, { method: 'PUT' });
  assert.equal(repeatPending.status, 400);
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full, 'repeat cancel must not double-restore');

  // ASSIGNED booking.
  await prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: 'available' } });
  const slot2 = tomorrowAt(11, 0);
  const assigned = await authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: slot2.date, booking_time: slot2.time }),
  });
  assert.equal(assigned.status, 201, assigned.text);
  assert.equal(assigned.body.status, 'assigned');
  const cancelAssigned = await authJson(token, `/bookings/${assigned.body.booking_id}/cancel`, { method: 'PUT' });
  assert.equal(cancelAssigned.status, 200, cancelAssigned.text);
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full);

  // IN_PROGRESS and COMPLETED cannot be cancelled.
  const mkDirect = (status) => prisma.booking.create({
    data: {
      userId: cust.id, providerId: provider.id, serviceId: fixtures.service.id,
      subscriptionId: null, bookingDate: dateStr(quarterFloor(plusMs(30 * 3600 * 1000))),
      bookingTime: '10:00', town, status, totalPrice: 5000, providerEarning: 3000,
    },
  });
  const ip = await mkDirect('IN_PROGRESS');
  assert.equal((await authJson(token, `/bookings/${ip.id}/cancel`, { method: 'PUT' })).status, 400);
  const done = await mkDirect('COMPLETED');
  assert.equal((await authJson(token, `/bookings/${done.id}/cancel`, { method: 'PUT' })).status, 400);
});

// ---------- PROVIDER CANCEL ----------

test('Provider cancel: boundary, states, replacement vs no-replacement coin behavior', async () => {
  const town = `BRule Town PC ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `pc${RND}`);
  await giveSubscription(cust.id);
  const full = await remainingUnits(cust.id, fixtures.category.id);
  const p1 = await mkProvider(town, 'Western', `pc1${RND}`);
  const p2 = await mkProvider(town, 'Western', `pc2${RND}`);

  const mkAssigned = async (startMs, withSub = true) => prisma.booking.create({
    data: {
      userId: cust.id, providerId: p1.provider.id, serviceId: fixtures.service.id,
      subscriptionId: withSub ? (await prisma.userSubscription.findFirst({ where: { userId: cust.id } })).id : null,
      bookingDate: '2099-01-01', bookingTime: '10:00', town, status: 'ASSIGNED',
      totalPrice: 5000, providerEarning: 3000,
    },
  }).then(async (b) => {
    // Move the slot precisely without touching anything else.
    const d = new Date(startMs);
    const mm = String(d.getMinutes()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    return prisma.booking.update({ where: { id: b.id }, data: { bookingDate: dateStr(d), bookingTime: `${hh}:${mm}` } });
  });

  // At least 4h out (boundary + margin): allowed, replacement keeps it active, coin stays consumed.
  const okB = await mkAssigned(Date.now() + 4 * 3600 * 1000 + 90 * 1000);
  const okRes = await authJson(p1.token, `/provider/bookings/${okB.id}/cancel`, { method: 'POST' });
  assert.equal(okRes.status, 200, okRes.text);
  assert.equal(okRes.body.outcome, 'reassigned');
  const okFresh = await prisma.booking.findUnique({ where: { id: okB.id } });
  assert.equal(okFresh.status, 'ASSIGNED');
  assert.equal(okFresh.providerId, p2.provider.id);
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 1, 'coin stays consumed after reroute');

  // Less than 4h out: rejected.
  const nearB = await mkAssigned(Date.now() + 4 * 3600 * 1000 - 90 * 1000);
  const nearRes = await authJson(p1.token, `/provider/bookings/${nearB.id}/cancel`, { method: 'POST' });
  assert.equal(nearRes.status, 409, nearRes.text);

  // IN_PROGRESS and COMPLETED: rejected (404 — not an assigned booking).
  const ip = await mkAssigned(Date.now() + 30 * 3600 * 1000);
  await prisma.booking.update({ where: { id: ip.id }, data: { status: 'IN_PROGRESS' } });
  assert.equal((await authJson(p1.token, `/provider/bookings/${ip.id}/cancel`, { method: 'POST' })).status, 404);
  const done = await mkAssigned(Date.now() + 30 * 3600 * 1000);
  await prisma.booking.update({ where: { id: done.id }, data: { status: 'COMPLETED' } });
  assert.equal((await authJson(p1.token, `/provider/bookings/${done.id}/cancel`, { method: 'POST' })).status, 404);

  // No replacement available: unique town, booking CANCELLED, coin restored.
  const loneTown = `BRule Lone ${RND}`;
  const loneCust = await mkUser('CUSTOMER', loneTown, 'Western', `pcl${RND}`);
  await giveSubscription(loneCust.id);
  const loneFull = await remainingUnits(loneCust.id, fixtures.category.id);
  const loneP = await mkProvider(loneTown, 'Western', `pclp${RND}`);
  const loneB = await prisma.booking.create({
    data: {
      userId: loneCust.id, providerId: loneP.provider.id, serviceId: fixtures.service.id,
      subscriptionId: (await prisma.userSubscription.findFirst({ where: { userId: loneCust.id } })).id,
      bookingDate: dateStr(quarterFloor(plusMs(30 * 3600 * 1000))), bookingTime: '10:00',
      town: loneTown, status: 'ASSIGNED', totalPrice: 5000, providerEarning: 3000,
    },
  });
  assert.equal(await remainingUnits(loneCust.id, fixtures.category.id), loneFull - 1);
  const loneRes = await authJson(loneP.token, `/provider/bookings/${loneB.id}/cancel`, { method: 'POST' });
  assert.equal(loneRes.status, 200, loneRes.text);
  assert.equal(loneRes.body.outcome, 'cancelled');
  assert.equal((await prisma.booking.findUnique({ where: { id: loneB.id } })).status, 'CANCELLED');
  assert.equal(await remainingUnits(loneCust.id, fixtures.category.id), loneFull, 'coin restored when no replacement');
});

// ---------- OFFLINE ----------

test('Offline: IN_PROGRESS blocks; <=4h stays; >4h reroutes; IN_PROGRESS never stripped', async () => {
  const town = `BRule Town OF ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `of${RND}`);
  await giveSubscription(cust.id);
  const p1 = await mkProvider(town, 'Western', `of1${RND}`);
  const p2 = await mkProvider(town, 'Western', `of2${RND}`);

  const mkBooking = (status, startMs) => {
    const d = new Date(startMs);
    return prisma.booking.create({
      data: {
        userId: cust.id, providerId: p1.provider.id, serviceId: fixtures.service.id,
        subscriptionId: null, bookingDate: dateStr(d),
        bookingTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        town, status, totalPrice: 5000, providerEarning: 3000,
      },
    });
  };

  // IN_PROGRESS present: offline blocked, job untouched.
  const ip = await mkBooking('IN_PROGRESS', Date.now() + 30 * 3600 * 1000);
  const blockedIp = await authJson(p1.token, '/provider/availability', { method: 'PUT', body: JSON.stringify({ availability_status: 'offline' }) });
  assert.equal(blockedIp.status, 400, blockedIp.text);
  assert.match(blockedIp.body.error, /in progress/i);
  await prisma.booking.update({ where: { id: ip.id }, data: { status: 'COMPLETED' } });

  // ASSIGNED within 4h: offline blocked, stays assigned to p1.
  const near = await mkBooking('ASSIGNED', Date.now() + 2 * 3600 * 1000);
  const blockedNear = await authJson(p1.token, '/provider/availability', { method: 'PUT', body: JSON.stringify({ availability_status: 'offline' }) });
  assert.equal(blockedNear.status, 400, blockedNear.text);
  assert.match(blockedNear.body.error, /within 4 hours/i);
  const nearFresh = await prisma.booking.findUnique({ where: { id: near.id } });
  assert.equal(nearFresh.status, 'ASSIGNED');
  assert.equal(nearFresh.providerId, p1.provider.id);
  await prisma.booking.update({ where: { id: near.id }, data: { status: 'COMPLETED' } });

  // ASSIGNED beyond 4h: offline allowed, rerouted to p2, stays ASSIGNED.
  // Fixed in-window slot so rerouting never depends on time of day.
  const farSlot = tomorrowAt(10, 0);
  const far = await prisma.booking.create({
    data: {
      userId: cust.id, providerId: p1.provider.id, serviceId: fixtures.service.id,
      subscriptionId: null, bookingDate: farSlot.date, bookingTime: farSlot.time,
      town, status: 'ASSIGNED', totalPrice: 5000, providerEarning: 3000,
    },
  });
  const offRes = await authJson(p1.token, '/provider/availability', { method: 'PUT', body: JSON.stringify({ availability_status: 'offline' }) });
  assert.equal(offRes.status, 200, offRes.text);
  const farFresh = await prisma.booking.findUnique({ where: { id: far.id } });
  assert.equal(farFresh.status, 'ASSIGNED');
  assert.equal(farFresh.providerId, p2.provider.id, 'must reroute to the other provider');
  // Back online for cleanliness.
  await authJson(p1.token, '/provider/availability', { method: 'PUT', body: JSON.stringify({ availability_status: 'online' }) });
});

// ---------- CUSTOMER HOLD ----------

test('Customer HOLD: PENDING/ASSIGNED cancel with one restore; IN_PROGRESS/COMPLETED untouched; repeat safe', async () => {
  const town = `BRule Town CH ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `ch${RND}`);
  await giveSubscription(cust.id);
  const subId = (await prisma.userSubscription.findFirst({ where: { userId: cust.id } })).id;
  const full = await remainingUnits(cust.id, fixtures.category.id);
  const { provider } = await mkProvider(town, 'Western', `chp${RND}`);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = tokenFor(admin);

  const mk = (status) => prisma.booking.create({
    data: {
      userId: cust.id, providerId: status === 'PENDING' ? null : provider.id,
      serviceId: fixtures.service.id, subscriptionId: subId,
      bookingDate: dateStr(quarterFloor(plusMs(30 * 3600 * 1000))), bookingTime: '10:00',
      town, status, totalPrice: 5000, providerEarning: 3000,
    },
  });
  const bPending = await mk('PENDING');
  const bAssigned = await mk('ASSIGNED');
  const bProg = await mk('IN_PROGRESS');
  const bDone = await mk('COMPLETED');
  // All four non-cancelled bookings consume a unit each.
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 4);

  const hold = await authJson(adminToken, `/admin/users/${cust.id}`, { method: 'PUT', body: JSON.stringify({ active: false }) });
  assert.equal(hold.status, 200, hold.text);
  assert.equal((await prisma.booking.findUnique({ where: { id: bPending.id } })).status, 'CANCELLED');
  assert.equal((await prisma.booking.findUnique({ where: { id: bAssigned.id } })).status, 'CANCELLED');
  assert.equal((await prisma.booking.findUnique({ where: { id: bProg.id } })).status, 'IN_PROGRESS', 'IN_PROGRESS must survive HOLD');
  assert.equal((await prisma.booking.findUnique({ where: { id: bDone.id } })).status, 'COMPLETED');
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 2, 'only the two cancelled coins restore');

  // Repeat HOLD processing: no state change, no double restore.
  const hold2 = await authJson(adminToken, `/admin/users/${cust.id}`, { method: 'PUT', body: JSON.stringify({ active: false }) });
  assert.equal(hold2.status, 200);
  assert.equal((await prisma.booking.findUnique({ where: { id: bProg.id } })).status, 'IN_PROGRESS');
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 2);

  // Held customer cannot create bookings (auth rejects deactivated accounts).
  const custToken = tokenFor(cust);
  const slot = quarterFloor(plusMs(30 * 3600 * 1000));
  const blocked = await authJson(custToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: fixtures.service.id, booking_date: dateStr(slot), booking_time: timeStr(slot) }),
  });
  assert.equal(blocked.status, 403, blocked.text);
});

// ---------- PROVIDER HOLD ----------

test('Provider HOLD: IN_PROGRESS untouched; <=4h cancels+restores; >4h reroutes; idempotent', async () => {
  const town = `BRule Town PH ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `ph${RND}`);
  await giveSubscription(cust.id);
  const subId = (await prisma.userSubscription.findFirst({ where: { userId: cust.id } })).id;
  const full = await remainingUnits(cust.id, fixtures.category.id);
  const p1 = await mkProvider(town, 'Western', `ph1${RND}`);
  const p2 = await mkProvider(town, 'Western', `ph2${RND}`);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = tokenFor(admin);

  const at = (ms) => {
    const d = new Date(ms);
    return { date: dateStr(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
  };
  const mk = (status, startMs) => {
    const s = at(startMs);
    return prisma.booking.create({
      data: {
        userId: cust.id, providerId: p1.provider.id, serviceId: fixtures.service.id,
        subscriptionId: subId, bookingDate: s.date, bookingTime: s.time,
        town, status, totalPrice: 5000, providerEarning: 3000,
      },
    });
  };
  const bProg = await mk('IN_PROGRESS', Date.now() + 30 * 3600 * 1000);
  const bNear = await mk('ASSIGNED', Date.now() + 2 * 3600 * 1000);
  // Far slot pinned in-window so the reroute assertion is time-of-day proof.
  const farSlot = tomorrowAt(10, 0);
  const bFar = await prisma.booking.create({
    data: {
      userId: cust.id, providerId: p1.provider.id, serviceId: fixtures.service.id,
      subscriptionId: subId, bookingDate: farSlot.date, bookingTime: farSlot.time,
      town, status: 'ASSIGNED', totalPrice: 5000, providerEarning: 3000,
    },
  });
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 3);

  const hold = await authJson(adminToken, `/admin/users/${p1.user.id}`, { method: 'PUT', body: JSON.stringify({ active: false }) });
  assert.equal(hold.status, 200, hold.text);
  assert.equal((await prisma.booking.findUnique({ where: { id: bProg.id } })).status, 'IN_PROGRESS');
  assert.equal((await prisma.booking.findUnique({ where: { id: bNear.id } })).status, 'CANCELLED');
  const farFresh = await prisma.booking.findUnique({ where: { id: bFar.id } });
  assert.equal(farFresh.status, 'ASSIGNED');
  assert.equal(farFresh.providerId, p2.provider.id, 'far booking reroutes to p2');
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 2, 'only the near coin restores');

  // Repeat HOLD: idempotent, no double restore, no state churn.
  const hold2 = await authJson(adminToken, `/admin/users/${p1.user.id}`, { method: 'PUT', body: JSON.stringify({ active: false }) });
  assert.equal(hold2.status, 200);
  assert.equal((await prisma.booking.findUnique({ where: { id: bFar.id } })).providerId, p2.provider.id);
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 2);
});

// ---------- NO-PROVIDER TIMEOUT ----------

test('No-provider timeout: PENDING at start cancels+restores; repeat run is a no-op', async () => {
  const cust = await mkUser('CUSTOMER', `BRule Town NP ${RND}`, 'Western', `np${RND}`);
  await giveSubscription(cust.id);
  const subId = (await prisma.userSubscription.findFirst({ where: { userId: cust.id } })).id;
  const full = await remainingUnits(cust.id, fixtures.category.id);
  const past = await prisma.booking.create({
    data: {
      userId: cust.id, serviceId: fixtures.service.id, subscriptionId: subId,
      bookingDate: '2026-01-01', bookingTime: '10:00 AM', town: 'Nowhere',
      status: 'PENDING', totalPrice: 5000, providerEarning: 3000,
    },
  });
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full - 1);
  const { bookingStart } = await import('../src/services/scheduling.js');
  const start = bookingStart('2026-01-01', '10:00 AM');
  const first = await processExpiredBookings(prisma, new Date(start.getTime() + 5000));
  assert.ok(first.some((b) => b.id === past.id), 'must cancel at start');
  assert.equal((await prisma.booking.findUnique({ where: { id: past.id } })).status, 'CANCELLED');
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full);
  const second = await processExpiredBookings(prisma, new Date(start.getTime() + 3600 * 1000));
  assert.equal(second.some((b) => b.id === past.id), false);
  assert.equal(await remainingUnits(cust.id, fixtures.category.id), full, 'no double restore');
});

// ---------- AUTO-ASSIGNMENT WINDOW / COOLDOWN / CLAIM ----------

test('Auto-assignment window honors 07:00-16:00 Colombo wall time; TZ-proof', async () => {
  assert.equal(isInAutoAssignmentWindow('2026-09-10', '06:59', { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 }), false);
  assert.equal(isInAutoAssignmentWindow('2026-09-10', '07:00', { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 }), true);
  assert.equal(isInAutoAssignmentWindow('2026-09-10', '12:00', { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 }), true);
  assert.equal(isInAutoAssignmentWindow('2026-09-10', '16:00', { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 }), true);
  assert.equal(isInAutoAssignmentWindow('2026-09-10', '04:00 PM', { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 }), true);
  assert.equal(isInAutoAssignmentWindow('2026-09-10', '17:00', { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 }), false);
  assert.equal(isInAutoAssignmentWindow('2026-09-10', '07:00 PM', { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 }), false);
  // Same assertions under a forced UTC server timezone (child process).
  const childOut = execFileSync(process.execPath, [path.join(__dirname, 'helpers', 'tz-window-check.mjs')], {
    env: { ...process.env, TZ: 'UTC' },
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.match(childOut, /TZ-CHECK-PASS/);
});

test('Auto-assignment HTTP: 07:00 assigns, 06:30/17:00 stay PENDING', async () => {
  const town = `BRule Town W1 ${RND}`;
  const cust = await mkUser('CUSTOMER', town, 'Western', `w1${RND}`);
  await giveSubscription(cust.id);
  const token = tokenFor(cust);
  await mkProvider(town, 'Western', `w1p${RND}`);
  const day = dateStr(plusMs(30 * 3600 * 1000));
  const mk = async (time) => (await authJson(token, '/bookings', {
    method: 'POST', body: JSON.stringify({ service_id: fixtures.service.id, booking_date: day, booking_time: time }),
  })).body;
  // Space the in-window bookings 6h apart so the 5h cooldown cannot interfere.
  assert.equal((await mk('06:30')).status, 'pending', 'outside window stays PENDING');
  assert.equal((await mk('07:00')).status, 'assigned', '07:00 boundary assigns');
  assert.equal((await mk('16:00')).status, 'assigned', '16:00 boundary assigns');
  assert.equal((await mk('17:00')).status, 'pending', 'outside window stays PENDING');
});

test('Cooldown is exactly 5h, provider-specific; failures do not extend it; claim unaffected', async () => {
  const townA = `BRule Town CDA ${RND}`;
  const townB = `BRule Town CDB ${RND}`;
  const custA = await mkUser('CUSTOMER', townA, 'Western', `cda${RND}`);
  const custB = await mkUser('CUSTOMER', townB, 'Western', `cdb${RND}`);
  await giveSubscription(custA.id);
  await giveSubscription(custB.id);
  const tokenA = tokenFor(custA);
  const tokenB = tokenFor(custB);
  const pA = await mkProvider(townA, 'Western', `cdap${RND}`);
  await mkProvider(townB, 'Western', `cdbp${RND}`);
  const day = dateStr(plusMs(30 * 3600 * 1000));
  const book = async (token, time) => (await authJson(token, '/bookings', {
    method: 'POST', body: JSON.stringify({ service_id: fixtures.service.id, booking_date: day, booking_time: time }),
  })).body;

  const s1 = await book(tokenA, '09:00');
  assert.equal(s1.status, 'assigned', 'first booking assigns to sole provider');
  // Different provider, own map: assigns despite pA cooldown.
  const other = await book(tokenB, '10:00');
  assert.equal(other.status, 'assigned', 'cooldown is provider-specific');
  // pA inside 5h of S1: stays PENDING (failed attempt, no cooldown row created).
  const s2 = await book(tokenA, '10:00');
  assert.equal(s2.status, 'pending', '5h cooldown blocks second auto-assignment');
  // S3 is >=5h after S1 but <5h after the failed S2: assigns, proving the
  // failed attempt did not start/reset the cooldown.
  const s3 = await book(tokenA, '14:15');
  assert.equal(s3.status, 'assigned', 'failed attempt must not extend cooldown');
  // Manual claim ignores the auto-assignment cooldown entirely.
  const claimRow = await prisma.booking.findUnique({ where: { id: s2.booking_id } });
  assert.equal(claimRow.status, 'PENDING');
  const claim = await authJson(pA.token, `/bookings/${s2.booking_id}/claim`, { method: 'POST' });
  assert.equal(claim.status, 200, claim.text);
  assert.equal((await prisma.booking.findUnique({ where: { id: s2.booking_id } })).status, 'ASSIGNED');
});
