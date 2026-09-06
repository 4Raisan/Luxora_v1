// Regression coverage for the Step-5 master fix pass:
// C5 reschedule honours the auto-assignment cooldown,
// C7 complaint status notifications are transition-gated,
// C9 password reset respects account deactivation policy.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
import { toBoolean, toPositiveInt } from '../src/middleware/validators.js';
import { selectSupersededPayHereOrders } from '../src/services/paymentContracts.js';
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5037;
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
  const response = await fetch(`${BASE}${apiPath}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, text };
};
const authJson = (token, apiPath, options = {}) => json(apiPath, {
  ...options,
  headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
});
const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET);
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tomorrowAt = (hh, mm) => {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return { date: dateStr(d), time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
};

async function mkUser(role, town, district, suffix) {
  return prisma.user.create({
    data: {
      name: `FixPass ${role} ${suffix}`,
      email: `fixpass.${role.toLowerCase()}.${suffix}@test.luxora`,
      passwordHash: await bcrypt.hash('pass123', 10),
      role,
      town,
      addressDistrict: district,
      active: true,
    },
  });
}

let fixtures;
async function makeFixtures() {
  const category = await prisma.category.create({ data: { name: `FixPassCat_${RND}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, title: `FixPass Service ${RND}`, price: 5000, providerEarning: 3000, durationMins: 60 },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `FixPass Plan ${RND}`, type: 'Auto Care', priceMonthly: 9000, durationDays: 30,
      features: '[]', entitlements: { create: [{ categoryId: category.id, units: 10 }] },
    },
  });
  return { category, service, plan };
}
const giveSubscription = (userId) => prisma.userSubscription.create({
  data: { userId, planId: fixtures.plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
});
const mkProvider = (town, district, suffix) => mkUser('PROVIDER', town, district, suffix).then(async (user) => ({
  user,
  provider: await prisma.provider.create({
    data: { userId: user.id, category: fixtures.category.name, serviceTowns: town, kycStatus: 'APPROVED', availabilityStatus: 'available' },
  }),
  token: tokenFor(user),
}));

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: 'inherit' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (attempt === 59) throw new Error('Test server failed to start');
  }
  fixtures = await makeFixtures();
  // Pin the scheduling rules under test (same defaults as the other suites).
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const settings = await authJson(tokenFor(admin), '/admin/settings/scheduling', {
    method: 'PUT',
    body: JSON.stringify({ auto_assignment_cooldown_hours: 5, auto_assignment_start_hour: 7, auto_assignment_end_hour: 16 }),
  });
  assert.equal(settings.status, 200);
});

after(async () => {
  await stopChildProcess(server);
  await prisma.$disconnect();
});

test('C5: reschedule assignment honours the auto-assignment cooldown boundary', async () => {
  const provider = await mkProvider('FixPass Town 5', 'Western', `c5p${RND}`);
  const customer = await mkUser('CUSTOMER', 'FixPass Town 5', 'Western', `c5c${RND}`);
  await prisma.user.update({ where: { id: customer.id }, data: { addressStreet: '1 Cooldown Way' } });
  await giveSubscription(customer.id);
  const token = tokenFor(customer);

  // First in-window booking of the day: auto-assignment is unrestricted.
  const slot1 = tomorrowAt(9, 0);
  const created = await authJson(token, '/bookings', { method: 'POST', body: JSON.stringify({ service_id: fixtures.service.id, booking_date: slot1.date, booking_time: slot1.time }) });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.body.status, 'assigned');
  assert.equal((await prisma.booking.findUnique({ where: { id: created.body.booking_id } })).providerId, provider.provider.id);
  const coinsBefore = (await authJson(token, '/subscriptions/entitlements')).body.entitlements[0].remaining_units;

  // Reschedule to 11:00 — inside the 5h cooldown (09:00 + 5h = 14:00): the
  // cooling-down provider must NOT be auto-assigned; the booking stays PENDING.
  const inside = await authJson(token, `/bookings/${created.body.booking_id}/reschedule`, {
    method: 'PUT', body: JSON.stringify({ booking_date: slot1.date, booking_time: '11:00', confirmed: true, reason: 'C5 inside cooldown' }),
  });
  assert.equal(inside.status, 200, inside.text);
  assert.equal(inside.body.status, 'pending');
  const insideBooking = await prisma.booking.findUnique({ where: { id: inside.body.id } });
  assert.equal(insideBooking.status, 'PENDING');
  assert.equal(insideBooking.providerId, null);

  // Reschedule again to exactly the cooldown boundary (14:00): allowed.
  const boundary = await authJson(token, `/bookings/${inside.body.booking_id ?? inside.body.id}/reschedule`, {
    method: 'PUT', body: JSON.stringify({ booking_date: slot1.date, booking_time: '14:00', confirmed: true, reason: 'C5 cooldown boundary' }),
  });
  assert.equal(boundary.status, 200, boundary.text);
  assert.equal(boundary.body.status, 'assigned');
  const boundaryBooking = await prisma.booking.findUnique({ where: { id: boundary.body.id } });
  assert.equal(boundaryBooking.status, 'ASSIGNED');
  assert.equal(boundaryBooking.providerId, provider.provider.id);

  // Reschedules reuse the original entitlement subscription: no extra coin burn.
  const coinsAfter = (await authJson(token, '/subscriptions/entitlements')).body.entitlements[0].remaining_units;
  assert.equal(coinsAfter, coinsBefore);
});

test('C7: complaint notifications fire once per actual status transition', async () => {
  const customer = await mkUser('CUSTOMER', 'FixPass Town 7', 'Western', `c7c${RND}`);
  const token = tokenFor(customer);

  const created = await authJson(token, '/complaints', { method: 'POST', body: JSON.stringify({ subject: `C7 complaint ${RND}`, description: 'Master fix pass regression complaint.' }) });
  assert.equal(created.status, 201, created.text);
  const complaintId = created.body.complaint.id;

  const notificationsFor = async () => prisma.notification.findMany({ where: { userId: customer.id, message: { contains: `#${complaintId}` } }, orderBy: { id: 'asc' } });

  // OPEN -> IN_REVIEW notifies once.
  const review1 = await authJson(tokenFor(await prisma.user.findFirst({ where: { role: 'ADMIN' } })), `/admin/complaints/${complaintId}`, {
    method: 'PUT', body: JSON.stringify({ status: 'in_review', admin_note: 'Looking into it' }),
  });
  assert.equal(review1.status, 200, review1.text);
  assert.equal((await notificationsFor()).length, 1);
  assert.match((await notificationsFor())[0].message, /reviewed/i);

  // Repeated IN_REVIEW updates never re-notify.
  const review2 = await authJson(tokenFor(await prisma.user.findFirst({ where: { role: 'ADMIN' } })), `/admin/complaints/${complaintId}`, {
    method: 'PUT', body: JSON.stringify({ status: 'in_review', admin_note: 'Still looking' }),
  });
  assert.equal(review2.status, 200);
  assert.equal((await notificationsFor()).length, 1);

  // IN_REVIEW -> RESOLVED notifies once; repeating RESOLVED never re-notifies.
  const adminToken = tokenFor(await prisma.user.findFirst({ where: { role: 'ADMIN' } }));
  await authJson(adminToken, `/admin/complaints/${complaintId}`, { method: 'PUT', body: JSON.stringify({ status: 'resolved', admin_note: 'Fixed' }) });
  assert.equal((await notificationsFor()).length, 2);
  await authJson(adminToken, `/admin/complaints/${complaintId}`, { method: 'PUT', body: JSON.stringify({ status: 'resolved' }) });
  assert.equal((await notificationsFor()).length, 2);
});

test('C9: password reset never issues or accepts credentials for deactivated accounts', async () => {
  // Deactivated account: request succeeds generically but creates no token.
  const deactivated = await mkUser('CUSTOMER', 'FixPass Town 9', 'Western', `c9a${RND}`);
  await prisma.user.update({ where: { id: deactivated.id }, data: { active: false } });
  const asked = await json('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email: deactivated.email }) });
  assert.equal(asked.status, 200);
  assert.match(asked.body.message, /If that account exists/i);
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: deactivated.id } }), 0);

  // Active account: request creates a usable token; deactivating afterwards
  // invalidates it at confirm time without changing the password.
  const active = await mkUser('CUSTOMER', 'FixPass Town 9', 'Western', `c9b${RND}`);
  const originalHash = active.passwordHash;
  const requested = await json('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email: active.email }) });
  assert.equal(requested.status, 200);
  const record = await prisma.passwordResetToken.findFirst({ where: { userId: active.id, usedAt: null } });
  assert.ok(record, 'active account must receive a reset token');

  await prisma.user.update({ where: { id: active.id }, data: { active: false } });
  const rawToken = `fixpass-raw-${RND}`;
  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex') } });

  const confirmed = await json('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token: rawToken, password: 'NewPass123!x' }) });
  assert.equal(confirmed.status, 400);
  const after = await prisma.user.findUnique({ where: { id: active.id } });
  assert.equal(after.passwordHash, originalHash);
  assert.equal(await prisma.passwordResetToken.count({ where: { id: record.id, usedAt: null } }), 1);

  // Reactivating restores the normal reset flow: the same token now works.
  await prisma.user.update({ where: { id: active.id }, data: { active: true } });
  const confirmedAgain = await json('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token: rawToken, password: 'NewPass123!x' }) });
  assert.equal(confirmedAgain.status, 200, confirmedAgain.text);
  const reactivated = await prisma.user.findUnique({ where: { id: active.id } });
  assert.notEqual(reactivated.passwordHash, originalHash);
});

test('C8: promotion-style boolean toggles parse every legitimate payload format', () => {
  assert.equal(toBoolean(true), true);
  assert.equal(toBoolean(false), false);
  assert.equal(toBoolean(1), true);
  assert.equal(toBoolean(0), false);
  assert.equal(toBoolean('true'), true);
  assert.equal(toBoolean('FALSE'), false);
  assert.equal(toBoolean(' 1 '), true);
  assert.equal(toBoolean('0'), false);
  assert.equal(toBoolean('yes'), null);
  assert.equal(toBoolean(2), null);
  assert.equal(toBoolean(null), null);
});

test('toPositiveInt rejects array/boolean coercion into resource ids', () => {
  assert.equal(toPositiveInt([7]), null);
  assert.equal(toPositiveInt(true), null);
  assert.equal(toPositiveInt('7'), 7);
  assert.equal(toPositiveInt('007'), 7);
  assert.equal(toPositiveInt(7), 7);
  assert.equal(toPositiveInt(0), null);
  assert.equal(toPositiveInt(-3), null);
  assert.equal(toPositiveInt('abc'), null);
  assert.equal(toPositiveInt('7.5'), null);
});

test('C6: stale pending PayHere orders are superseded by safe rules only', () => {
  const now = new Date('2026-09-06T12:00:00Z');
  const mk = (id, gateway, status, createdAt) => ({ id, gateway, status, createdAt: new Date(createdAt) });
  const candidates = [
    mk(1, 'PAYHERE', 'PENDING', '2026-09-06T11:00:00Z'), // 1h old -> superseded
    mk(2, 'PAYHERE', 'PENDING', '2026-09-06T11:50:00Z'), // 10 min old -> still maybe payable, kept
    mk(3, 'PAYHERE', 'COMPLETED', '2026-09-05T12:00:00Z'), // settled history -> never touched
    mk(4, 'PAYHERE', 'FAILED', '2026-09-05T12:00:00Z'), // already closed
    mk(5, 'NOWPAYMENTS', 'PENDING', '2026-09-05T12:00:00Z'), // different gateway
    mk(99, 'PAYHERE', 'PENDING', '2026-09-06T10:00:00Z'), // current order itself
  ];
  const superseded = selectSupersededPayHereOrders(candidates, { currentPaymentId: 99, now });
  assert.deepEqual(superseded, [1]);
});
