import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import { getEntitlementSnapshot } from '../src/services/entitlements.js';
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5034;
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
  if (server) {
    if (process.platform === 'win32') {
      try { spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    } else {
      server.kill();
    }
  }
  await prisma.$disconnect();
});

test('Rule 1: Customer can request direct refund even with prior usage, revoking remaining entitlements upon refund approval', async () => {
  const customerUser = await prisma.user.create({
    data: { name: `Cust R1 ${RND}`, email: `cust.r1.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Colombo', addressDistrict: 'Western' },
  });
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const customerToken = jwt.sign({ id: customerUser.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);
  const adminToken = jwt.sign({ id: adminUser.id, role: 'ADMIN', tokenVersion: adminUser.tokenVersion }, JWT_SECRET);

  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Auto Care' }, include: { entitlements: true } });
  const sub = await prisma.userSubscription.create({
    data: {
      userId: customerUser.id,
      planId: plan.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400000),
      status: 'active',
    },
  });
  await prisma.payment.create({
    data: {
      userId: customerUser.id,
      planId: plan.id,
      subscriptionId: sub.id,
      gateway: 'DEMO',
      gatewayOrderId: `demo-order-${RND}-${Date.now()}`,
      idempotencyKey: `idem-${RND}-${Date.now()}`,
      expectedAmount: plan.priceMonthly,
      expectedCurrency: 'LKR',
      capturedAmount: plan.priceMonthly,
      capturedCurrency: 'LKR',
      status: 'COMPLETED',
    },
  });

  const service = await prisma.service.findFirst({ where: { category: { name: 'Auto Care' } } });
  // Create 1 booking (usage > 0)
  const bookRes = await authJson(customerToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: '2026-09-02', booking_time: '10:00' }),
  });
  assert.equal(bookRes.status, 201);

  // Request direct refund (previously was blocked if used_units > 0)
  const refundReq = await authJson(customerToken, '/refunds', {
    method: 'POST',
    body: JSON.stringify({ subscription_id: sub.id, reason: 'I want a refund for the package' }),
  });
  assert.equal(refundReq.status, 201, `Direct refund request should succeed. Error: ${JSON.stringify(refundReq.body)}`);

  // Admin approves refund
  const approveRes = await authJson(adminToken, `/admin/refunds/${refundReq.body.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'APPROVED', admin_note: 'Approved demo refund' }),
  });
  assert.equal(approveRes.status, 200);

  // Sub should now be status: 'refunded' and remaining entitlements revoked
  const updatedSub = await prisma.userSubscription.findUnique({ where: { id: sub.id } });
  assert.equal(updatedSub.status, 'refunded');

  const snapshot = await getEntitlementSnapshot(prisma, customerUser.id);
  const autoCat = snapshot.find((s) => s.category_name === 'Auto Care');
  assert.equal(autoCat?.remaining_units || 0, 0, 'Remaining entitlements must be 0 after refund');
});

test('Rule 2: Customer deactivation cancels active bookings, restores entitlement, notifies customer and provider', async () => {
  const cust = await prisma.user.create({
    data: { name: `Cust R2 ${RND}`, email: `cust.r2.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Kandy', addressDistrict: 'Central' },
  });
  const provUser = await prisma.user.create({
    data: { name: `Prov R2 ${RND}`, email: `prov.r2.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Kandy', addressDistrict: 'Central', active: true },
  });
  await prisma.provider.create({
    data: { userId: provUser.id, category: 'Garden Care', serviceTowns: 'Kandy', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = jwt.sign({ id: adminUser.id, role: 'ADMIN', tokenVersion: adminUser.tokenVersion }, JWT_SECRET);

  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Garden Care' }, include: { entitlements: true } });
  await prisma.userSubscription.create({
    data: {
      userId: cust.id,
      planId: plan.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400000),
      status: 'active',
    },
  });

  const service = await prisma.service.findFirst({ where: { category: { name: 'Garden Care' } } });
  const custToken = jwt.sign({ id: cust.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);

  const bookRes = await authJson(custToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: '2026-09-03', booking_time: '11:00' }),
  });
  assert.equal(bookRes.status, 201);
  const bookingId = bookRes.body.booking_id;

  // Admin deactivates the customer
  const deactRes = await authJson(adminToken, `/admin/users/${cust.id}`, {
    method: 'PUT',
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactRes.status, 200);

  // Verify booking was auto-cancelled
  const updatedBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
  assert.equal(updatedBooking.status, 'CANCELLED');
  assert.match(updatedBooking.cancellationReason, /Customer account was deactivated/i);

  // Check notifications for both customer and provider
  const custNotif = await prisma.notification.findFirst({ where: { userId: cust.id, message: { contains: 'deactivated' } } });
  assert.ok(custNotif, 'Customer should receive deactivation cancellation notification');

  const provNotif = await prisma.notification.findFirst({ where: { userId: provUser.id, message: { contains: 'deactivated' } } });
  assert.ok(provNotif, 'Assigned provider should receive cancellation notification');
});

test('Rule 3 & 4: Provider deactivation/KYC rejection returns assigned bookings to auto-assignment, and PENDING/REJECTED providers can log in', async () => {
  const provUser = await prisma.user.create({
    data: { name: `Prov R3 ${RND}`, email: `prov.r3.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Galle', addressDistrict: 'Southern', active: true },
  });
  const prov = await prisma.provider.create({
    data: { userId: provUser.id, category: 'Pet Care', serviceTowns: 'Galle', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const cust = await prisma.user.create({
    data: { name: `Cust R3 ${RND}`, email: `cust.r3.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Galle', addressDistrict: 'Southern' },
  });
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = jwt.sign({ id: adminUser.id, role: 'ADMIN', tokenVersion: adminUser.tokenVersion }, JWT_SECRET);

  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Combo Package' }, include: { entitlements: true } });
  await prisma.userSubscription.create({
    data: { userId: cust.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });
  const service = await prisma.service.findFirst({ where: { category: { name: 'Pet Care' } } });
  const custToken = jwt.sign({ id: cust.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);

  const bookRes = await authJson(custToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: '2026-09-04', booking_time: '14:00' }),
  });
  assert.equal(bookRes.status, 201);
  const bookingId = bookRes.body.booking_id;

  // Admin rejects provider KYC
  const rejectRes = await authJson(adminToken, `/admin/providers/${prov.id}/kyc`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'rejected', rejection_reason: 'NIC image too blurry' }),
  });
  assert.equal(rejectRes.status, 200);

  // Booking should be unassigned / returned to PENDING auto-assignment flow
  const unassignedBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
  assert.equal(unassignedBooking.status, 'PENDING');
  assert.equal(unassignedBooking.providerId, null);

  // Rule 4 check: REJECTED provider CAN log in and receive token
  const loginRes = await json('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `prov.r3.${RND}@test.luxora`, password: 'pass123' }),
  });
  assert.equal(loginRes.status, 200, `REJECTED provider should be allowed to log in. Got: ${loginRes.status} ${loginRes.text}`);
  assert.ok(loginRes.body.token, 'Token should be returned');
  assert.equal(loginRes.body.provider?.kycStatus, 'REJECTED');
  assert.equal(loginRes.body.provider?.kycRejectionReason, 'NIC image too blurry');

  // But operational endpoints must remain blocked by requireApprovedKyc
  const provToken = loginRes.body.token;
  const opRes = await authJson(provToken, '/provider/availability');
  assert.equal(opRes.status, 403, 'Operational endpoint must be blocked for REJECTED provider');
});

test('Rule 5: PIN visibility (Start PIN visible when ASSIGNED, End PIN hidden until IN_PROGRESS, customer can cancel IN_PROGRESS)', async () => {
  const cust = await prisma.user.create({
    data: { name: `Cust R5 ${RND}`, email: `cust.r5.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Negombo', addressDistrict: 'Western' },
  });
  const provUser = await prisma.user.create({
    data: { name: `Prov R5 ${RND}`, email: `prov.r5.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Negombo', addressDistrict: 'Western', active: true },
  });
  await prisma.provider.create({
    data: { userId: provUser.id, category: 'Auto Care', serviceTowns: 'Negombo', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });

  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Auto Care' }, include: { entitlements: true } });
  await prisma.userSubscription.create({
    data: { userId: cust.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });
  const service = await prisma.service.findFirst({ where: { category: { name: 'Auto Care' } } });
  const custToken = jwt.sign({ id: cust.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);
  const provToken = jwt.sign({ id: provUser.id, role: 'PROVIDER', tokenVersion: 0 }, JWT_SECRET);

  const bookRes = await authJson(custToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: '2026-09-05', booking_time: '15:00' }),
  });
  assert.equal(bookRes.status, 201);
  const bookingId = bookRes.body.booking_id;

  // When ASSIGNED: GET /pins returns start_pin, and completion_pin is null
  const pinsAssigned = await authJson(custToken, `/bookings/${bookingId}/pins`);
  assert.equal(pinsAssigned.status, 200);
  assert.ok(pinsAssigned.body.start_pin, 'start_pin must be visible when ASSIGNED');
  assert.equal(pinsAssigned.body.completion_pin, null, 'completion_pin must be hidden when ASSIGNED');

  const startPin = pinsAssigned.body.start_pin;

  // Provider uploads BEFORE photo
  await prisma.servicePhoto.create({
    data: { bookingId, kind: 'BEFORE', filePath: 'dummy.jpg', originalName: 'dummy.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 },
  });

  // Provider starts booking with Start PIN
  const startRes = await authJson(provToken, `/bookings/${bookingId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'in_progress', pin_code: startPin }),
  });
  assert.equal(startRes.status, 200, `Provider should start booking with start PIN: ${startRes.text}`);

  // When IN_PROGRESS: GET /pins returns completion_pin
  const pinsInProgress = await authJson(custToken, `/bookings/${bookingId}/pins`);
  assert.equal(pinsInProgress.status, 200);
  assert.ok(pinsInProgress.body.completion_pin, 'completion_pin must be visible when IN_PROGRESS');

  // Customer cancels the IN_PROGRESS booking (new Rule 5 allows customer cancellation of in_progress)
  const cancelRes = await authJson(custToken, `/bookings/${bookingId}/cancel`, {
    method: 'PUT',
  });
  assert.equal(cancelRes.status, 200, `Customer should be able to cancel in-progress booking: ${cancelRes.text}`);

  const cancelledBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
  assert.equal(cancelledBooking.status, 'CANCELLED');
});

test('Rule 6 & 10: Admin cancellation notifies customer + provider, and CANCELLED bookings cannot be revived', async () => {
  const cust = await prisma.user.create({
    data: { name: `Cust R6 ${RND}`, email: `cust.r6.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Matara', addressDistrict: 'Southern' },
  });
  const provUser = await prisma.user.create({
    data: { name: `Prov R6 ${RND}`, email: `prov.r6.${RND}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Matara', addressDistrict: 'Southern', active: true },
  });
  await prisma.provider.create({
    data: { userId: provUser.id, category: 'Garden Care', serviceTowns: 'Matara', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = jwt.sign({ id: adminUser.id, role: 'ADMIN', tokenVersion: adminUser.tokenVersion }, JWT_SECRET);

  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Garden Care' }, include: { entitlements: true } });
  await prisma.userSubscription.create({
    data: { userId: cust.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });
  const service = await prisma.service.findFirst({ where: { category: { name: 'Garden Care' } } });
  const custToken = jwt.sign({ id: cust.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);

  const bookRes = await authJson(custToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: '2026-09-06', booking_time: '09:00' }),
  });
  assert.equal(bookRes.status, 201);
  const bookingId = bookRes.body.booking_id;

  // Admin cancels the booking
  const cancelRes = await authJson(adminToken, `/admin/bookings/${bookingId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
  assert.equal(cancelRes.status, 200);

  // Verify notifications sent to both customer and provider
  const custNotif = await prisma.notification.findFirst({ where: { userId: cust.id, message: { contains: 'cancelled' } } });
  assert.ok(custNotif, 'Customer should receive admin cancellation notification');

  const provNotif = await prisma.notification.findFirst({ where: { userId: provUser.id, message: { contains: 'cancelled by administrator' } } });
  assert.ok(provNotif, 'Assigned provider should receive admin cancellation notification');

  // Rule 10: Try to revive the CANCELLED booking back to PENDING or ASSIGNED -> MUST BE REJECTED
  const reviveRes = await authJson(adminToken, `/admin/bookings/${bookingId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'pending' }),
  });
  assert.equal(reviveRes.status, 400, 'Reviving cancelled booking must be rejected with 400');
  assert.match(reviveRes.body.error, /cannot modify a cancelled booking/i);
});

test('Rule 8: Support ticket notification link opens /admin-dashboard', async () => {
  const uid = crypto.randomUUID().slice(0, 8);
  const cust = await prisma.user.create({
    data: { name: `Cust R8 ${uid}`, email: `cust.r8.${uid}.${Date.now()}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER' },
  });
  const custToken = jwt.sign({ id: cust.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);

  const ticketRes = await authJson(custToken, '/support', {
    method: 'POST',
    body: JSON.stringify({ subject: 'Need assistance with package', message: 'Hello, please help' }),
  });
  assert.equal(ticketRes.status, 201);

  // Check admin notification link
  const adminNotif = await prisma.notification.findFirst({
    where: { message: { contains: 'New support ticket' } },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(adminNotif);
  assert.equal(adminNotif.link, '/admin-dashboard', 'Support notification link must point to /admin-dashboard');
});

test('Audit Fix 1: Rescheduled booking enforces progressive PIN rules (6-digit, hidden completion PIN, progressive start PIN)', async () => {
  const uid = crypto.randomUUID().slice(0, 8);
  // Monaragala has no auto-care providers seeded -> will be PENDING
  const custPending = await prisma.user.create({
    data: { name: `Cust Resched P ${uid}`, email: `cust.resched.p.${uid}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Monaragala', addressDistrict: 'Uva' },
  });
  const tokenPending = jwt.sign({ id: custPending.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);

  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Auto Care' }, include: { entitlements: true } });
  await prisma.userSubscription.create({
    data: { userId: custPending.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });
  const service = await prisma.service.findFirst({ where: { category: { name: 'Auto Care' } } });

  // 1. Create unassigned booking -> PENDING
  const bookRes1 = await authJson(tokenPending, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: '2026-09-08', booking_time: '10:00' }),
  });
  assert.equal(bookRes1.status, 201);
  const bookingId1 = bookRes1.body.booking_id;
  assert.equal(bookRes1.body.status, 'pending');
  assert.equal(bookRes1.body.start_pin, null, 'Pending booking must not expose start_pin');
  assert.equal(bookRes1.body.completion_pin, null, 'Pending booking must not expose completion_pin');

  // 2. Reschedule unassigned booking -> new booking must be PENDING with null PINs
  const reschedRes1 = await authJson(tokenPending, `/bookings/${bookingId1}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ booking_date: '2026-09-09', booking_time: '14:00', reason: 'Need afternoon slot', confirmed: true }),
  });
  assert.equal(reschedRes1.status, 200, `Reschedule should succeed: ${reschedRes1.text}`);
  assert.equal(reschedRes1.body.status, 'pending');
  assert.equal(reschedRes1.body.start_pin, null, 'Pending rescheduled booking must not leak start_pin');
  assert.equal(reschedRes1.body.completion_pin, null, 'Pending rescheduled booking must never leak completion_pin');

  // 3. Test assigned reschedule: Colombo with an active auto-care provider
  const provUser = await prisma.user.create({
    data: { name: `Prov Resched ${uid}`, email: `prov.resched.${uid}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Colombo', addressDistrict: 'Western', active: true },
  });
  await prisma.provider.create({
    data: { userId: provUser.id, category: 'Auto Care', serviceTowns: 'Colombo', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const custAssigned = await prisma.user.create({
    data: { name: `Cust Resched A ${uid}`, email: `cust.resched.a.${uid}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Colombo', addressDistrict: 'Western' },
  });
  const tokenAssigned = jwt.sign({ id: custAssigned.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);
  await prisma.userSubscription.create({
    data: { userId: custAssigned.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });

  const bookRes2 = await authJson(tokenAssigned, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: '2026-09-08', booking_time: '10:00' }),
  });
  assert.equal(bookRes2.status, 201);
  const bookingId2 = bookRes2.body.booking_id;
  assert.equal(bookRes2.body.status, 'assigned');
  assert.match(bookRes2.body.start_pin, /^\d{6}$/, 'Assigned booking must return 6-digit start_pin');
  assert.equal(bookRes2.body.completion_pin, null, 'Assigned booking must never return completion_pin');

  const reschedRes2 = await authJson(tokenAssigned, `/bookings/${bookingId2}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ booking_date: '2026-09-09', booking_time: '11:00', reason: 'Change time', confirmed: true }),
  });
  assert.equal(reschedRes2.status, 200);
  assert.equal(reschedRes2.body.status, 'assigned');
  assert.match(reschedRes2.body.start_pin, /^\d{6}$/, 'Assigned rescheduled booking must return 6-digit start_pin');
  assert.equal(reschedRes2.body.completion_pin, null, 'Assigned rescheduled booking must never leak completion_pin');
});

test('Audit Fix 2: PayHere approved refund can be manually settled by admin if gateway webhook does not arrive', async () => {
  const uid = crypto.randomUUID().slice(0, 8);
  const cust = await prisma.user.create({
    data: { name: `Cust PayHere ${uid}`, email: `cust.payhere.${uid}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER' },
  });
  const custToken = jwt.sign({ id: cust.id, role: 'CUSTOMER', tokenVersion: 0 }, JWT_SECRET);
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = jwt.sign({ id: adminUser.id, role: 'ADMIN', tokenVersion: adminUser.tokenVersion }, JWT_SECRET);

  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Garden Care' } });
  const sub = await prisma.userSubscription.create({
    data: { userId: cust.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });
  const payment = await prisma.payment.create({
    data: {
      userId: cust.id,
      planId: plan.id,
      subscriptionId: sub.id,
      gateway: 'PAYHERE',
      gatewayOrderId: `ph-order-${uid}`,
      idempotencyKey: `ph-idem-${uid}`,
      expectedAmount: plan.priceMonthly,
      expectedCurrency: 'LKR',
      capturedAmount: plan.priceMonthly,
      capturedCurrency: 'LKR',
      status: 'COMPLETED',
    },
  });

  // Customer requests refund
  const reqRes = await authJson(custToken, '/refunds', {
    method: 'POST',
    body: JSON.stringify({ subscription_id: sub.id, reason: 'Moving away' }),
  });
  assert.equal(reqRes.status, 201);
  const refundId = reqRes.body.id;

  // Admin approves refund -> live PayHere enters APPROVED awaiting gateway webhook
  const approveRes = await authJson(adminToken, `/admin/refunds/${refundId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'APPROVED', admin_note: 'Approved for refund' }),
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, 'approved');
  assert.equal(approveRes.body.awaiting_gateway_confirmation, true);

  // Subscription remains active while awaiting gateway confirmation
  let freshSub = await prisma.userSubscription.findUnique({ where: { id: sub.id } });
  assert.equal(freshSub.status, 'active');

  // Admin subsequently manually settles the refund after verifying external transfer
  const settleRes = await authJson(adminToken, `/admin/refunds/${refundId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'REFUNDED', admin_note: 'Manually verified PayHere refund transaction' }),
  });
  assert.equal(settleRes.status, 200);
  assert.equal(settleRes.body.status, 'refunded');
  assert.equal(settleRes.body.manually_settled, true);

  // Subscription and payment are now fully revoked
  freshSub = await prisma.userSubscription.findUnique({ where: { id: sub.id } });
  assert.equal(freshSub.status, 'refunded');
  const freshPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(freshPayment.status, 'REFUNDED');
});

test('Audit Fix 4: Customer registration and town update enforce canonical Sri Lankan location list', async () => {
  const uid = crypto.randomUUID().slice(0, 8);

  // 1. Invalid town during customer registration must be rejected with 400
  const badReg = await json('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Bad Cust ${uid}`,
      email: `bad.cust.${uid}@test.luxora`,
      password: 'SecretPass123!',
      role: 'customer',
      town: 'NonExistentCityXYZ',
    }),
  });
  assert.equal(badReg.status, 400);
  assert.match(badReg.body.error, /valid town/i);

  // 2. Valid town registration succeeds and populates canonical name + province
  const goodReg = await json('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Good Cust ${uid}`,
      email: `good.cust.${uid}@test.luxora`,
      password: 'SecretPass123!',
      role: 'customer',
      town: 'Kandy',
    }),
  });
  assert.equal(goodReg.status, 201);
  assert.equal(goodReg.body.user.town, 'Kandy');

  const custUser = await prisma.user.findUnique({ where: { email: `good.cust.${uid}@test.luxora` } });
  assert.equal(custUser.town, 'Kandy');
  assert.equal(custUser.addressDistrict, 'Central');

  const custToken = goodReg.body.token;

  // 3. Invalid town update via PUT /customer/town must fail with 400
  const badUpdate = await authJson(custToken, '/customer/town', {
    method: 'PUT',
    body: JSON.stringify({ town: 'UnknownTown999' }),
  });
  assert.equal(badUpdate.status, 400);

  // 4. Valid town update via PUT /customer/town succeeds and updates province
  const goodUpdate = await authJson(custToken, '/customer/town', {
    method: 'PUT',
    body: JSON.stringify({ town: 'Galle' }),
  });
  assert.equal(goodUpdate.status, 200);
  assert.equal(goodUpdate.body.town, 'Galle');
  assert.equal(goodUpdate.body.address_district, 'Southern');
});

