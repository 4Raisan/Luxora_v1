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
import { bookingStart } from '../src/services/scheduling.js';
import { processExpiredBookings } from '../src/services/bookingTimeouts.js';
import { getEntitlementSnapshot } from '../src/services/entitlements.js';
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5033;
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
const json = async (path, options = {}) => {
  const response = await fetch(`${BASE}${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, text };
};

const authJson = (token, path, options = {}) => json(path, {
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
  },
});

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
});

after(async () => {
  await stopChildProcess(server);
  await prisma.$disconnect();
});

test('Rule 1: PENDING booking timeout (> 30 mins after start) auto-cancels and restores entitlement', async () => {
  const category = await prisma.category.create({ data: { name: `TimeoutCat_${RND}_1` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, title: `Service Pending ${RND}`, price: 4000, providerEarning: 2500, durationMins: 60 },
  });
  const customer = await prisma.user.create({
    data: { email: `cust_pending_${RND}@example.com`, passwordHash: 'fake', role: 'CUSTOMER', name: 'Pending Cust', town: 'Colombo' },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Plan Pending ${RND}`,
      type: 'Auto Care',
      priceMonthly: 5000,
      durationDays: 30,
      features: '[]',
      entitlements: { create: [{ categoryId: category.id, units: 1 }] },
    },
  });
  const subscription = await prisma.userSubscription.create({
    data: { userId: customer.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });

  // Create PENDING booking with past date/time (e.g. 1 hour ago)
  const pastBooking = await prisma.booking.create({
    data: {
      userId: customer.id,
      serviceId: service.id,
      subscriptionId: subscription.id,
      bookingDate: '2026-01-01',
      bookingTime: '10:00 AM',
      town: 'Colombo',
      status: 'PENDING',
      totalPrice: 4000,
      providerEarning: 2500,
    },
  });

  // Verify usage consumed
  let snapshot = await getEntitlementSnapshot(prisma, customer.id);
  assert.equal(snapshot[0].remaining_units, 0, '1 unit should be consumed before expiry');

  // Run timeout processing
  const start1 = bookingStart('2026-01-01', '10:00 AM');
  const expired1 = await processExpiredBookings(prisma, new Date(start1.getTime() + 45 * 60 * 1000));
  assert.ok(expired1.some((b) => b.id === pastBooking.id), 'Pending booking should be expired');

  const updatedBooking = await prisma.booking.findUnique({ where: { id: pastBooking.id } });
  assert.equal(updatedBooking.status, 'CANCELLED');
  assert.ok(updatedBooking.cancellationReason.includes('30 minutes'), 'Reason must mention 30 mins');

  // Verify entitlement is safely restored
  snapshot = await getEntitlementSnapshot(prisma, customer.id);
  assert.equal(snapshot[0].remaining_units, 1, '1 unit should be restored to customer');

  // Verify notification was created
  const notif = await prisma.notification.findFirst({ where: { userId: customer.id } });
  assert.ok(notif, 'Customer must receive notification');
  assert.ok(notif.message.includes('cancelled'), 'Notification message should indicate cancellation');
});

test('Rule 1: ASSIGNED booking timeout (> 2 hours after start) auto-cancels, restores entitlement, provider unpaid', async () => {
  const category = await prisma.category.create({ data: { name: `TimeoutCat_${RND}_2` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, title: `Service Assigned ${RND}`, price: 5000, providerEarning: 3000, durationMins: 60 },
  });
  const customer = await prisma.user.create({
    data: { email: `cust_assigned_${RND}@example.com`, passwordHash: 'fake', role: 'CUSTOMER', name: 'Assigned Cust', town: 'Kandy' },
  });
  const providerUser = await prisma.user.create({
    data: { email: `prov_assigned_${RND}@example.com`, passwordHash: 'fake', role: 'PROVIDER', name: 'Assigned Prov', town: 'Kandy' },
  });
  const provider = await prisma.provider.create({
    data: { userId: providerUser.id, kycStatus: 'APPROVED', category: category.name, serviceTowns: 'Kandy', earnings: 0 },
  });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Plan Assigned ${RND}`,
      type: 'Auto Care',
      priceMonthly: 6000,
      durationDays: 30,
      features: '[]',
      entitlements: { create: [{ categoryId: category.id, units: 1 }] },
    },
  });
  const subscription = await prisma.userSubscription.create({
    data: { userId: customer.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });

  const assignedBooking = await prisma.booking.create({
    data: {
      userId: customer.id,
      providerId: provider.id,
      serviceId: service.id,
      subscriptionId: subscription.id,
      bookingDate: '2026-01-01',
      bookingTime: '08:00 AM',
      town: 'Kandy',
      status: 'ASSIGNED',
      totalPrice: 5000,
      providerEarning: 3000,
    },
  });

  // Run timeout at 2.5 hours after start
  const start2 = bookingStart('2026-01-01', '08:00 AM');
  const expired2 = await processExpiredBookings(prisma, new Date(start2.getTime() + 2.5 * 60 * 60 * 1000));
  assert.ok(expired2.some((b) => b.id === assignedBooking.id), 'Assigned booking must expire');

  const updatedBooking = await prisma.booking.findUnique({ where: { id: assignedBooking.id } });
  assert.equal(updatedBooking.status, 'CANCELLED');
  assert.ok(updatedBooking.cancellationReason.includes('2 hours'), 'Reason must mention 2 hours');

  // Verify entitlement restored
  const snapshot = await getEntitlementSnapshot(prisma, customer.id);
  assert.equal(snapshot[0].remaining_units, 1, 'Entitlement unit must be restored');

  // Verify provider earnings remain 0
  const freshProvider = await prisma.provider.findUnique({ where: { id: provider.id } });
  assert.equal(Number(freshProvider.earnings), 0, 'Provider must not receive earnings for timed out booking');
});

test('Rule 2: IN_PROGRESS completion deadline (> 2 hours after scheduled end) auto-cancels and withholds payout', async () => {
  const category = await prisma.category.create({ data: { name: `TimeoutCat_${RND}_3` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, title: `Service InProgress ${RND}`, price: 7000, providerEarning: 4500, durationMins: 90 }, // 1.5h
  });
  const customer = await prisma.user.create({
    data: { email: `cust_inp_${RND}@example.com`, passwordHash: 'fake', role: 'CUSTOMER', name: 'Inp Cust', town: 'Galle' },
  });
  const providerUser = await prisma.user.create({
    data: { email: `prov_inp_${RND}@example.com`, passwordHash: 'fake', role: 'PROVIDER', name: 'Inp Prov', town: 'Galle' },
  });
  const provider = await prisma.provider.create({
    data: { userId: providerUser.id, kycStatus: 'APPROVED', category: category.name, serviceTowns: 'Galle', earnings: 0 },
  });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Plan InP ${RND}`,
      type: 'Auto Care',
      priceMonthly: 8000,
      durationDays: 30,
      features: '[]',
      entitlements: { create: [{ categoryId: category.id, units: 1 }] },
    },
  });
  const subscription = await prisma.userSubscription.create({
    data: { userId: customer.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });

  // Scheduled: 10:00 AM, End: 11:30 AM (90 mins). 2h deadline after end = 1:30 PM (start + 3.5h).
  const inProgressBooking = await prisma.booking.create({
    data: {
      userId: customer.id,
      providerId: provider.id,
      serviceId: service.id,
      subscriptionId: subscription.id,
      bookingDate: '2026-01-01',
      bookingTime: '10:00 AM',
      town: 'Galle',
      status: 'IN_PROGRESS',
      totalPrice: 7000,
      providerEarning: 4500,
    },
  });

  // Check at start + 3h -> should not expire yet (deadline is start + 3.5h)
  const start3 = bookingStart('2026-01-01', '10:00 AM');
  let expired = await processExpiredBookings(prisma, new Date(start3.getTime() + 3 * 60 * 60 * 1000));
  assert.equal(expired.some((b) => b.id === inProgressBooking.id), false, 'Should not expire before deadline');

  // Check at start + 3.75h -> should expire
  expired = await processExpiredBookings(prisma, new Date(start3.getTime() + 3.75 * 60 * 60 * 1000));
  assert.ok(expired.some((b) => b.id === inProgressBooking.id), 'In-progress booking must expire past deadline');

  const updatedBooking = await prisma.booking.findUnique({ where: { id: inProgressBooking.id } });
  assert.equal(updatedBooking.status, 'CANCELLED');
  assert.ok(updatedBooking.cancellationReason.includes('2 hours after scheduled end time'));

  // Entitlement restored
  const snapshot = await getEntitlementSnapshot(prisma, customer.id);
  assert.equal(snapshot[0].remaining_units, 1);

  // Provider payout not credited
  const freshProvider = await prisma.provider.findUnique({ where: { id: provider.id } });
  assert.equal(Number(freshProvider.earnings), 0);
});

test('Rule 3: Rescheduling cancels old booking, generates new booking with re-assignment & preserves entitlement', async () => {
  const category = await prisma.category.create({ data: { name: `ReschedCat_${RND}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, title: `Service Reschedule ${RND}`, price: 5000, providerEarning: 3000, durationMins: 60 },
  });
  const customer = await prisma.user.create({
    data: { email: `cust_resched_${RND}@example.com`, passwordHash: 'fake', role: 'CUSTOMER', name: 'Resched Cust', town: 'Negombo' },
  });
  const customerToken = jwt.sign({ id: customer.id, email: customer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });

  // Provider 1 in Negombo
  const provUser1 = await prisma.user.create({
    data: { email: `prov1_resched_${RND}@example.com`, passwordHash: 'fake', role: 'PROVIDER', name: 'Prov 1', town: 'Negombo' },
  });
  const prov1 = await prisma.provider.create({
    data: { userId: provUser1.id, kycStatus: 'APPROVED', category: category.name, serviceTowns: 'Negombo', availabilityStatus: 'available' },
  });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Plan Resched ${RND}`,
      type: 'Auto Care',
      priceMonthly: 6000,
      durationDays: 30,
      features: '[]',
      entitlements: { create: [{ categoryId: category.id, units: 1 }] },
    },
  });
  const subscription = await prisma.userSubscription.create({
    data: { userId: customer.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });

  // Future booking: Day after tomorrow at 10:00 AM
  const futureDate1 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const futureDate2 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const initialBooking = await prisma.booking.create({
    data: {
      userId: customer.id,
      providerId: prov1.id,
      serviceId: service.id,
      subscriptionId: subscription.id,
      bookingDate: futureDate1,
      bookingTime: '10:00 AM',
      town: 'Negombo',
      status: 'ASSIGNED',
      autoAssigned: true,
      totalPrice: 5000,
      providerEarning: 3000,
    },
  });

  // Verify entitlement is consumed
  let snapshot = await getEntitlementSnapshot(prisma, customer.id);
  assert.equal(snapshot[0].remaining_units, 0, 'Entitlement consumed for initial booking');

  // Customer reschedules via API
  const res = await authJson(customerToken, `/bookings/${initialBooking.id}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({
      confirmed: true,
      booking_date: futureDate2,
      booking_time: '11:00 AM',
      reason: 'Urgent meeting change',
    }),
  });

  assert.equal(res.status, 200, `Reschedule should succeed: ${JSON.stringify(res.body)}`);
  assert.ok(res.body.id, 'New booking ID returned');
  assert.equal(res.body.old_booking_id, initialBooking.id);
  assert.equal(res.body.booking_date, futureDate2);

  // Check old booking
  const oldB = await prisma.booking.findUnique({ where: { id: initialBooking.id } });
  assert.equal(oldB.status, 'CANCELLED');
  assert.ok(oldB.cancellationReason.includes('Rescheduled'));
  assert.equal(oldB.rescheduleReason, 'Urgent meeting change');

  // Check new booking
  const newB = await prisma.booking.findUnique({ where: { id: res.body.id } });
  assert.ok(newB, 'New booking must exist in database');
  assert.equal(newB.bookingDate, futureDate2);
  assert.equal(newB.bookingTime, '11:00 AM');
  assert.equal(newB.subscriptionId, subscription.id);
  assert.equal(newB.status, 'ASSIGNED'); // prov1 auto-assigned
  assert.equal(newB.providerId, prov1.id);

  // Entitlement preservation: exactly 1 unit used (by new booking), remaining = 0 (no loss, no double consumption)
  snapshot = await getEntitlementSnapshot(prisma, customer.id);
  assert.equal(snapshot[0].remaining_units, 0);
  assert.equal(snapshot[0].used_units, 1);
});

test('Rule 4: Provider KYC registration, approval, and rejection email state transitions', async () => {
  const admin = await prisma.user.create({
    data: { email: `admin_kyc_${RND}@example.com`, passwordHash: 'fake', role: 'ADMIN', name: 'Admin Test' },
  });
  const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Provider Registration
  const regEmail = `prov_reg_${RND}@example.com`;
  const regRes = await json('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'KYC Prov Test',
      email: regEmail,
      password: 'StrongPassword123!',
      role: 'PROVIDER',
      category: 'Auto Care',
      town: 'Colombo',
    }),
  });
  assert.equal(regRes.status, 201, `Provider registration must succeed: ${JSON.stringify(regRes.body)}`);

  const createdProvider = await prisma.provider.findFirst({
    where: { user: { email: regEmail } },
    include: { user: true },
  });
  assert.ok(createdProvider, 'Provider record must exist');
  assert.equal(createdProvider.kycStatus, 'PENDING');

  // 2. Admin approves KYC
  const approveRes = await authJson(adminToken, `/admin/providers/${createdProvider.id}/kyc`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'approved' }),
  });
  assert.equal(approveRes.status, 200);

  const approvedProvider = await prisma.provider.findUnique({ where: { id: createdProvider.id } });
  assert.equal(approvedProvider.kycStatus, 'APPROVED');

  // 3. Admin rejects KYC with reason
  const rejectRes = await authJson(adminToken, `/admin/providers/${createdProvider.id}/kyc`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'rejected', rejection_reason: 'NIC document photo is blurred and unreadable.' }),
  });
  assert.equal(rejectRes.status, 200);

  const rejectedProvider = await prisma.provider.findUnique({ where: { id: createdProvider.id } });
  assert.equal(rejectedProvider.kycStatus, 'REJECTED');
  assert.equal(rejectedProvider.kycRejectionReason, 'NIC document photo is blurred and unreadable.');
});

test('Concurrency & Race safety: Simultaneous PIN start attempt vs. Timeout cancellation', async () => {
  const category = await prisma.category.create({ data: { name: `RaceCat_${RND}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, title: `Service Race ${RND}`, price: 5000, providerEarning: 3000, durationMins: 60 },
  });
  const customer = await prisma.user.create({
    data: { email: `cust_race_${RND}@example.com`, passwordHash: 'fake', role: 'CUSTOMER', name: 'Race Cust', town: 'Matara' },
  });
  const provUser = await prisma.user.create({
    data: { email: `prov_race_${RND}@example.com`, passwordHash: 'fake', role: 'PROVIDER', name: 'Race Prov', town: 'Matara' },
  });
  const provider = await prisma.provider.create({
    data: { userId: provUser.id, kycStatus: 'APPROVED', category: category.name, serviceTowns: 'Matara', availabilityStatus: 'available' },
  });
  const provToken = jwt.sign({ id: provUser.id, email: provUser.email, role: 'PROVIDER' }, JWT_SECRET, { expiresIn: '1h' });

  const startPin = '1234';
  const startPinHash = await bcrypt.hash(startPin, 10);

  // Booking scheduled 3 hours ago (already past 2h start timeout)
  const expiredBooking = await prisma.booking.create({
    data: {
      userId: customer.id,
      providerId: provider.id,
      serviceId: service.id,
      bookingDate: '2026-01-01',
      bookingTime: '08:00 AM',
      town: 'Matara',
      status: 'ASSIGNED',
      startPinHash,
      totalPrice: 5000,
      providerEarning: 3000,
    },
  });

  // Create required BEFORE service photo
  await prisma.servicePhoto.create({
    data: {
      bookingId: expiredBooking.id,
      kind: 'BEFORE',
      filePath: '/tmp/test.jpg',
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    },
  });

  // Attempt status update on expired booking via API
  const updateRes = await authJson(provToken, `/bookings/${expiredBooking.id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'in_progress', pin_code: startPin }),
  });

  assert.equal(updateRes.status, 400, 'Expired start window must reject status update');
  assert.ok(updateRes.body.error.includes('expired'), 'Error message must state deadline expired');

  const finalBooking = await prisma.booking.findUnique({ where: { id: expiredBooking.id } });
  assert.equal(finalBooking.status, 'CANCELLED');
});
