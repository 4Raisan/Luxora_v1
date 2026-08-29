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
import { JWT_SECRET } from '../src/middleware/auth.js';
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5029;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RND = crypto.randomUUID().slice(0, 8);

const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'demo',
  RESEND_API_KEY: '',
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
  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
});

after(async () => {
  if (server) {
    server.kill();
    await new Promise((r) => server.on('exit', r));
  }
});

test('Booking Flow: Normal booking, rapid duplicate idempotency, and concurrent request protection without P2028', async () => {
  // 1. Create category and service
  const category = await prisma.category.create({
    data: { name: `TestCat_${RND}`, description: 'Test Category' },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      title: `Concierge Service ${RND}`,
      description: 'Luxury concierge test',
      price: 5000,
      providerEarning: 3500,
      durationMins: 60,
    },
  });

  // 2. Create customer user
  const customer = await prisma.user.create({
    data: {
      email: `customer_${RND}@example.com`,
      passwordHash: 'fakehash',
      role: 'CUSTOMER',
      name: 'Test Customer',
      town: 'Colombo',
    },
  });

  const customerToken = jwt.sign({ id: customer.id, email: customer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });

  // 3. Create plan with entitlements and active user subscription
  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Plan ${RND}`,
      type: 'concierge',
      priceMonthly: 15000,
      durationDays: 30,
      features: '["Priority concierge"]',
      entitlements: {
        create: [{ categoryId: category.id, units: 10 }],
      },
    },
  });

  await prisma.userSubscription.create({
    data: {
      userId: customer.id,
      planId: plan.id,
      status: 'active',
      endDate: new Date(Date.now() + 30 * 86400000),
    },
  });

  // 4. Test 1: Normal booking creation
  const futureDate = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const bookingTime = '10:00 AM';

  const res1 = await authJson(customerToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({
      service_id: service.id,
      booking_date: futureDate,
      booking_time: bookingTime,
    }),
  });

  assert.equal(res1.status, 201, `Expected 201 Created, got ${res1.status}: ${JSON.stringify(res1.body)}`);
  assert.ok(res1.body.booking_id, 'booking_id must be returned');
  assert.ok(res1.body.start_pin, 'start_pin must be returned');
  assert.ok(res1.body.completion_pin, 'completion_pin must be returned');
  assert.equal(res1.body.status, 'pending');

  const firstBookingId = res1.body.booking_id;
  const firstStartPin = res1.body.start_pin;
  const firstCompletionPin = res1.body.completion_pin;

  // 5. Test 2: Rapid duplicate booking request within 15 seconds (Idempotency check)
  const res2 = await authJson(customerToken, '/bookings', {
    method: 'POST',
    body: JSON.stringify({
      service_id: service.id,
      booking_date: futureDate,
      booking_time: bookingTime,
    }),
  });

  assert.equal(res2.status, 200, `Expected 200 OK on duplicate within 15s, got ${res2.status}: ${JSON.stringify(res2.body)}`);
  assert.equal(res2.body.booking_id, firstBookingId, 'Should return the identical existing booking ID');
  assert.equal(res2.body.duplicate, true, 'Should mark response as duplicate');
  assert.equal(res2.body.start_pin, undefined, 'Duplicate response MUST NOT expose start_pin');
  assert.equal(res2.body.completion_pin, undefined, 'Duplicate response MUST NOT expose completion_pin');
  assert.equal(res2.body.pin_code, undefined, 'Duplicate response MUST NOT expose pin_code');

  // 6. Test 3: Authorized Owner PIN Retrieval via GET /api/bookings/:id/pins
  const ownerPinRes = await authJson(customerToken, `/bookings/${firstBookingId}/pins`);
  assert.equal(ownerPinRes.status, 200, `Owner must be able to retrieve PINs, got ${ownerPinRes.status}`);
  assert.equal(ownerPinRes.body.start_pin, firstStartPin, 'Decrypted start_pin must match original');
  assert.equal(ownerPinRes.body.completion_pin, firstCompletionPin, 'Decrypted completion_pin must match original');

  // 7. Test 4: Another Customer cannot access owner's PINs (ID Manipulation Defense)
  const otherCustomer = await prisma.user.create({
    data: {
      email: `other_cust_${RND}@example.com`,
      passwordHash: 'fakehash',
      role: 'CUSTOMER',
      name: 'Other Customer',
      town: 'Colombo',
    },
  });
  const otherCustomerToken = jwt.sign({ id: otherCustomer.id, email: otherCustomer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });

  const attackerPinRes = await authJson(otherCustomerToken, `/bookings/${firstBookingId}/pins`);
  assert.equal(attackerPinRes.status, 404, 'Other customer must NOT be able to view another customer PINs');
  assert.equal(attackerPinRes.body.start_pin, undefined);

  // 8. Test 5: Provider cannot access customer's PIN endpoint
  const providerUser = await prisma.user.create({
    data: {
      email: `provider_${RND}@example.com`,
      passwordHash: 'fakehash',
      role: 'PROVIDER',
      name: 'Test Provider',
    },
  });
  const providerToken = jwt.sign({ id: providerUser.id, email: providerUser.email, role: 'PROVIDER' }, JWT_SECRET, { expiresIn: '1h' });

  const providerPinRes = await authJson(providerToken, `/bookings/${firstBookingId}/pins`);
  assert.equal(providerPinRes.status, 403, 'Provider must be rejected with 403 on customer PIN endpoint');

  // 9. Test 6: Manipulated non-existent booking ID
  const fakeIdRes = await authJson(customerToken, '/bookings/99999999/pins');
  assert.equal(fakeIdRes.status, 404, 'Manipulated booking ID must return 404');

  // 10. Test 7: GET /api/bookings/my does NOT expose plaintext PINs
  const myListRes = await authJson(customerToken, '/bookings/my');
  assert.equal(myListRes.status, 200);
  const myBooking = myListRes.body.find((b) => b.id === firstBookingId);
  assert.ok(myBooking, 'Booking must be in customer list');
  assert.equal(myBooking.pin_code, undefined, 'GET /my must not expose pin_code');
  assert.equal(myBooking.start_pin, undefined, 'GET /my must not expose start_pin');
  assert.equal(myBooking.completion_pin, undefined, 'GET /my must not expose completion_pin');
  assert.equal(myBooking.customerStartPinCipher, undefined, 'GET /my must not expose cipher');

  // 11. Test 8: Concurrent simultaneous booking requests for a new time slot
  const newTime = '02:00 PM';
  const [concRes1, concRes2] = await Promise.all([
    authJson(customerToken, '/bookings', {
      method: 'POST',
      body: JSON.stringify({
        service_id: service.id,
        booking_date: futureDate,
        booking_time: newTime,
      }),
    }),
    authJson(customerToken, '/bookings', {
      method: 'POST',
      body: JSON.stringify({
        service_id: service.id,
        booking_date: futureDate,
        booking_time: newTime,
      }),
    }),
  ]);

  // One request must succeed with 201 (or 200 via 15s idempotency), neither should return 500 / P2028
  assert.ok(
    [200, 201].includes(concRes1.status) && [200, 201, 409].includes(concRes2.status),
    `Both concurrent requests should be safely handled without 500. Got ${concRes1.status} and ${concRes2.status}`
  );
  assert.notEqual(concRes1.status, 500, 'concRes1 must not return HTTP 500');
  assert.notEqual(concRes2.status, 500, 'concRes2 must not return HTTP 500');

  // 12. Verify in database: Exactly 2 active bookings created in total
  const dbBookings = await prisma.booking.findMany({
    where: { userId: customer.id, status: { not: 'CANCELLED' } },
  });
  assert.equal(dbBookings.length, 2, `Expected exactly 2 bookings in database, found ${dbBookings.length}`);

  // 13. State-Sync Test: Booking cancellation immediately updates GET /bookings/my and restores entitlements
  const cancelRes = await authJson(customerToken, `/bookings/${firstBookingId}/cancel`, {
    method: 'PUT',
  });
  assert.equal(cancelRes.status, 200, 'Cancellation must succeed');

  const refreshedMyBookings = await authJson(customerToken, '/bookings/my');
  assert.equal(refreshedMyBookings.status, 200);
  const cancelledBooking = refreshedMyBookings.body.find((b) => b.id === firstBookingId);
  assert.ok(cancelledBooking, 'Cancelled booking must still be returned in history');
  assert.equal(cancelledBooking.status.toLowerCase(), 'cancelled', 'Status must be updated to cancelled');

  // Verify entitlements restored in GET /subscriptions/entitlements
  const refreshedEntitlements = await authJson(customerToken, '/subscriptions/entitlements');
  assert.equal(refreshedEntitlements.status, 200);
  assert.ok(refreshedEntitlements.body.entitlements.length > 0, 'Entitlements should be present');
});

test('Concurrent customers cannot be assigned to the same provider time slot', async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const category = await prisma.category.create({ data: { name: `SlotCat_${suffix}` } });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      title: `Slot Service ${suffix}`,
      price: 5000,
      providerEarning: 2500,
      durationMins: 60,
    },
  });
  const providerUser = await prisma.user.create({
    data: { email: `slot_provider_${suffix}@example.com`, passwordHash: 'fakehash', role: 'PROVIDER', name: 'Slot Provider', town: 'Colombo' },
  });
  const provider = await prisma.provider.create({
    data: { userId: providerUser.id, category: category.name, serviceTowns: 'Colombo', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Slot Plan ${suffix}`,
      type: 'Auto Care',
      priceMonthly: 10000,
      features: '[]',
      entitlements: { create: [{ categoryId: category.id, units: 1 }] },
    },
  });

  const customers = await Promise.all([1, 2].map(async (index) => {
    const user = await prisma.user.create({
      data: { email: `slot_customer_${suffix}_${index}@example.com`, passwordHash: 'fakehash', role: 'CUSTOMER', name: `Slot Customer ${index}`, town: 'Colombo' },
    });
    await prisma.userSubscription.create({ data: { userId: user.id, planId: plan.id, status: 'active', endDate: new Date(Date.now() + 30 * 86400000) } });
    return { user, token: jwt.sign({ id: user.id, email: user.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' }) };
  }));

  const bookingDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const responses = await Promise.all(customers.map(({ token }) => authJson(token, '/bookings', {
    method: 'POST',
    body: JSON.stringify({ service_id: service.id, booking_date: bookingDate, booking_time: '10:00' }),
  })));
  assert.ok(responses.every((response) => [200, 201].includes(response.status)), JSON.stringify(responses.map((response) => response.body)));

  const bookings = await prisma.booking.findMany({ where: { userId: { in: customers.map(({ user }) => user.id) } } });
  const assignedAtSlot = bookings.filter((booking) => booking.providerId === provider.id && booking.status === 'ASSIGNED');
  assert.equal(assignedAtSlot.length, 1, 'Only one simultaneous booking may be assigned to a provider at a given time');
  assert.equal(bookings.filter((booking) => booking.status === 'PENDING').length, 1, 'The conflicting booking must remain pending for later assignment');
});

test('Concurrent wrong Service PIN attempts atomically trigger lockout', async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const category = await prisma.category.create({ data: { name: `PinCat_${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, title: `Pin Service ${suffix}`, price: 1000, providerEarning: 500 } });
  const customer = await prisma.user.create({ data: { email: `pin_customer_${suffix}@example.com`, passwordHash: 'fakehash', role: 'CUSTOMER', name: 'PIN Customer' } });
  const providerUser = await prisma.user.create({ data: { email: `pin_provider_${suffix}@example.com`, passwordHash: 'fakehash', role: 'PROVIDER', name: 'PIN Provider' } });
  const provider = await prisma.provider.create({ data: { userId: providerUser.id, category: category.name, kycStatus: 'APPROVED' } });
  const providerToken = jwt.sign({ id: providerUser.id, email: providerUser.email, role: 'PROVIDER' }, JWT_SECRET, { expiresIn: '1h' });
  const booking = await prisma.booking.create({
    data: {
      userId: customer.id,
      providerId: provider.id,
      serviceId: service.id,
      bookingDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      bookingTime: '10:00',
      status: 'ASSIGNED',
      totalPrice: service.price,
      providerEarning: service.providerEarning,
      startPinHash: await bcrypt.hash('123456', 4),
      completionPinHash: await bcrypt.hash('654321', 4),
      pinExpiresAt: new Date(Date.now() + 2 * 86400000),
    },
  });
  await prisma.servicePhoto.create({ data: { bookingId: booking.id, kind: 'BEFORE', filePath: `pin-${suffix}.jpg`, originalName: 'before.jpg', mimeType: 'image/jpeg', sizeBytes: 10 } });

  const attempts = await Promise.all(Array.from({ length: 5 }, () => authJson(providerToken, `/bookings/${booking.id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'in_progress', pin_code: '000000' }),
  })));
  assert.ok(attempts.every((response) => [400, 429].includes(response.status)), JSON.stringify(attempts.map((response) => response.body)));

  const locked = await prisma.booking.findUnique({ where: { id: booking.id } });
  assert.ok(locked.pinAttempts >= 5, `Expected at least 5 recorded attempts, got ${locked.pinAttempts}`);
  assert.ok(locked.pinLockedUntil && locked.pinLockedUntil > new Date(), 'Fifth concurrent failure must lock PIN verification');

  const correctWhileLocked = await authJson(providerToken, `/bookings/${booking.id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'in_progress', pin_code: '123456' }),
  });
  assert.equal(correctWhileLocked.status, 429, 'Correct PIN must not bypass an active lockout');
});

test('Password reset token is single-use and revokes existing JWT sessions', async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { email: `reset_${suffix}@example.com`, passwordHash: await bcrypt.hash('OldPassword123!', 4), role: 'CUSTOMER', name: 'Reset Customer' },
  });
  const oldToken = jwt.sign({ id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
  const resetToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(resetToken).digest('hex'), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });

  const attempts = await Promise.all([1, 2].map(() => json('/auth/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: resetToken, password: 'NewPassword123!' }),
  })));
  assert.equal(attempts.filter((response) => response.status === 200).length, 1, 'Exactly one reset confirmation may consume the token');
  assert.equal(attempts.filter((response) => response.status === 400).length, 1, 'Concurrent replay must be rejected');

  const oldSession = await authJson(oldToken, '/auth/me');
  assert.equal(oldSession.status, 403, 'Password reset must revoke JWTs issued under the previous token version');
});

test('Admin revenue reports use the common verified LKR contract across gateways', async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true } });
  const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, tokenVersion: admin.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
  const customer = await prisma.user.create({ data: { email: `revenue_${suffix}@example.com`, passwordHash: 'fakehash', role: 'CUSTOMER', name: 'Revenue Customer' } });
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });
  const createdAt = new Date('2035-04-15T12:00:00.000Z');
  await prisma.payment.createMany({ data: [
    { userId: customer.id, planId: plan.id, gateway: 'PAYHERE', gatewayOrderId: `REV-PH-${suffix}`, idempotencyKey: `REV-PH-${suffix}`, status: 'COMPLETED', expectedAmount: 10000, expectedCurrency: 'LKR', capturedAmount: 10000, capturedCurrency: 'LKR', createdAt },
    { userId: customer.id, planId: plan.id, gateway: 'NOWPAYMENTS', gatewayOrderId: `REV-NP-${suffix}`, idempotencyKey: `REV-NP-${suffix}`, status: 'COMPLETED', expectedAmount: 20000, expectedCurrency: 'LKR', capturedAmount: 60.5, capturedCurrency: 'USD', createdAt },
  ] });

  const report = await authJson(adminToken, '/admin/reports?from=2035-04-15&to=2035-04-15');
  assert.equal(report.status, 200);
  assert.equal(report.body.summary.revenue, 30000, 'Revenue must sum verified LKR prices, not mixed captured currencies');
  assert.equal(report.body.summary.revenueCurrency, 'LKR');
});

test('Failed provider payout restores earnings exactly once under concurrent admin decisions', async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true } });
  const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, tokenVersion: admin.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
  const providerUser = await prisma.user.create({ data: { email: `payout_${suffix}@example.com`, passwordHash: 'fakehash', role: 'PROVIDER', name: 'Payout Provider' } });
  const provider = await prisma.provider.create({ data: { userId: providerUser.id, category: 'Auto Care', kycStatus: 'APPROVED', earnings: 0 } });
  const bank = await prisma.providerBankAccount.create({ data: { providerId: provider.id, bankName: 'Test Bank', accountHolder: 'Payout Provider', accountNumber: `acct-${suffix}`, selected: true } });
  const payout = await prisma.providerPayout.create({ data: { providerId: provider.id, bankAccountId: bank.id, period: `2036-${suffix.slice(0, 2)}`, amount: 123.45, idempotencyKey: `payout-test-${suffix}` } });

  const responses = await Promise.all([1, 2].map(() => authJson(adminToken, `/admin/payouts/${payout.id}`, { method: 'PUT', body: JSON.stringify({ status: 'FAILED' }) })));
  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.ok(responses.every((response) => [200, 404, 409].includes(response.status)));
  const refreshedProvider = await prisma.provider.findUnique({ where: { id: provider.id } });
  assert.equal(Number(refreshedProvider.earnings), 123.45, 'Failed payout amount must be restored exactly once');
});

test('Audit Verification: Concurrent Payment Settlement Idempotency', async () => {
  const customer = await prisma.user.create({
    data: {
      email: `conc_pay_${Date.now()}_${RND}@example.com`,
      passwordHash: 'fakehash',
      role: 'CUSTOMER',
      name: 'Concurrent Pay Customer',
    },
  });
  const token = jwt.sign({ id: customer.id, email: customer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });

  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });
  assert.ok(plan, 'Plan must exist');

  // Create demo order
  const orderRes = await authJson(token, '/payments/demo/order', {
    method: 'POST',
    body: JSON.stringify({ plan_id: plan.id }),
  });
  assert.equal(orderRes.status, 201);
  const paymentId = orderRes.body.payment_id;

  // Execute 5 concurrent completion requests
  const completionPromises = Array.from({ length: 5 }, () =>
    authJson(token, `/payments/demo/${paymentId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ outcome: 'success' }),
    })
  );

  const results = await Promise.all(completionPromises);
  const successCount = results.filter((r) => r.status === 200).length;
  const conflictCount = results.filter((r) => r.status === 409).length;

  assert.equal(successCount, 1, 'Exactly one concurrent completion must succeed with 200');
  assert.equal(conflictCount, 4, 'Other 4 concurrent completions must receive 409 (already completed)');

  // Verify only 1 subscription record exists for this payment
  const subscriptions = await prisma.userSubscription.findMany({
    where: { userId: customer.id, planId: plan.id },
  });
  assert.equal(subscriptions.length, 1, 'Exactly 1 subscription record must be created');

  // Verify payment status is COMPLETED
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  assert.equal(payment.status, 'COMPLETED');
});

test('Audit Verification: Payment Receipt Resend & Failure Recovery', async () => {
  const customer = await prisma.user.create({
    data: {
      email: `receipt_retry_${Date.now()}@example.com`,
      passwordHash: 'fakehash',
      role: 'CUSTOMER',
      name: 'Receipt Retry Customer',
    },
  });
  const token = jwt.sign({ id: customer.id, email: customer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });
  const otherCustomer = await prisma.user.create({
    data: {
      email: `other_cust_${Date.now()}@example.com`,
      passwordHash: 'fakehash',
      role: 'CUSTOMER',
      name: 'Other Customer',
    },
  });
  const otherToken = jwt.sign({ id: otherCustomer.id, email: otherCustomer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });

  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });

  // Create and complete demo payment
  const orderRes = await authJson(token, '/payments/demo/order', {
    method: 'POST',
    body: JSON.stringify({ plan_id: plan.id }),
  });
  const paymentId = orderRes.body.payment_id;
  await authJson(token, `/payments/demo/${paymentId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ outcome: 'success' }),
  });

  // 1. Resend receipt authorized customer call
  const resendRes = await authJson(token, `/payments/${paymentId}/receipt/resend`, { method: 'POST' });
  assert.equal(resendRes.status, 200);

  // 2. Resend receipt IDOR attempt by other customer -> 403 Forbidden
  const idorResendRes = await authJson(otherToken, `/payments/${paymentId}/receipt/resend`, { method: 'POST' });
  assert.equal(idorResendRes.status, 403, 'Cross-customer receipt resend must return 403');
});

test('Audit Verification: Admin Action Audit Trail Logging', async () => {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true } });
  assert.ok(admin, 'Admin user must exist');
  const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

  // Perform an admin mutation
  const updateRes = await authJson(adminToken, '/admin/settings/scheduling', {
    method: 'PUT',
    body: JSON.stringify({
      auto_assignment_cooldown_hours: 6,
      auto_assignment_start_hour: 8,
      auto_assignment_end_hour: 17,
    }),
  });
  assert.equal(updateRes.status, 200);

  // Verify audit log entry was created
  const auditRes = await authJson(adminToken, '/admin/audit-logs?limit=10');
  assert.equal(auditRes.status, 200);
  assert.ok(Array.isArray(auditRes.body));
  const entry = auditRes.body.find((l) => l.action === 'UPDATE_SCHEDULING_SETTINGS');
  assert.ok(entry, 'Audit log entry for scheduling update must exist');
  assert.equal(entry.adminId, admin.id);
});

test('Audit Verification: IDOR and Role Access Boundary Enforcement', async () => {
  const customer = await prisma.user.create({
    data: {
      email: `idor_test_${Date.now()}@example.com`,
      passwordHash: 'fakehash',
      role: 'CUSTOMER',
      name: 'IDOR Customer',
    },
  });
  const customerToken = jwt.sign({ id: customer.id, email: customer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });

  // Customer attempting admin endpoints must get 403
  assert.equal((await authJson(customerToken, '/admin/users')).status, 403);
  assert.equal((await authJson(customerToken, '/admin/stats')).status, 403);
  assert.equal((await authJson(customerToken, '/admin/audit-logs')).status, 403);

  // Customer attempting provider operational endpoints must get 403
  assert.equal((await authJson(customerToken, '/provider/availability')).status, 403);
  assert.equal((await authJson(customerToken, '/provider/earnings')).status, 403);

  const providerUser = await prisma.user.create({ data: { email: `payment_role_${Date.now()}@example.com`, passwordHash: 'fakehash', role: 'PROVIDER', name: 'Payment Role Provider' } });
  const providerToken = jwt.sign({ id: providerUser.id, email: providerUser.email, role: 'PROVIDER', tokenVersion: providerUser.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });
  assert.equal((await authJson(providerToken, '/payments/demo/order', { method: 'POST', body: JSON.stringify({ plan_id: plan.id }) })).status, 403, 'Only customers may create package-payment orders');
});
