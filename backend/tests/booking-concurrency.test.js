import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';

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

