import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';
import './assert-test-database.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5025;
const BASE = `http://127.0.0.1:${PORT}/api`;

const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'demo',
  NODE_ENV: 'test',
  JWT_SECRET: 'test_secret_for_fresh_smoke_2026',
  RESEND_API_KEY: '',
};

let server;

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: 'ignore' });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) break;
    } catch { /* waiting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (attempt === 59) throw new Error('Test server failed to start');
  }
});

after(async () => {
  if (server) {
    if (process.platform === 'win32') {
      try { spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    } else {
      try { server.kill('SIGKILL'); } catch {}
    }
  }
  await prisma.$disconnect();
});

test('1. Demo Accounts, Bcrypt Hashes, and Authenticated Logins', async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@luxora.lk', 'provider@luxora.lk', 'customer@luxora.lk'] } },
    include: { provider: true },
  });
  assert.equal(users.length, 3, 'All 3 demo users must exist in fresh database');

  for (const u of users) {
    assert.ok(u.passwordHash.startsWith('$2a$') || u.passwordHash.startsWith('$2b$'), `Password must be bcrypt hash for ${u.email}`);
    assert.ok(bcrypt.compareSync('luxora123', u.passwordHash), `Bcrypt hash must verify against luxora123 for ${u.email}`);
  }

  // Admin login
  const adminRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@luxora.lk', password: 'luxora123' }),
  });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.equal(adminData.user.role, 'ADMIN');
  assert.ok(adminData.token);
  assert.equal(adminData.user.passwordHash, undefined, 'Password hash must never be returned in API');

  // Provider login
  const providerRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'provider@luxora.lk', password: 'luxora123' }),
  });
  assert.equal(providerRes.status, 200);
  const providerData = await providerRes.json();
  assert.equal(providerData.user.role, 'PROVIDER');
  assert.ok(providerData.token);

  // Customer login
  const customerRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@luxora.lk', password: 'luxora123' }),
  });
  assert.equal(customerRes.status, 200);
  const customerData = await customerRes.json();
  assert.equal(customerData.user.role, 'CUSTOMER');
  assert.ok(customerData.token);

  // Wrong password
  const invalidRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@luxora.lk', password: 'wrongpassword' }),
  });
  assert.equal(invalidRes.status, 401);
});

test('2. Complete Booking Flow on Fresh DB: Purchase, Auto-Assignment, Service PINs & Lifecycle', async () => {
  // Login customer
  const customerLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@luxora.lk', password: 'luxora123' }),
  }).then(r => r.json());

  // Login provider
  const providerLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'provider@luxora.lk', password: 'luxora123' }),
  }).then(r => r.json());

  // 1. Customer purchases Basic Package plan
  const existingCust = await prisma.user.findUnique({ where: { email: 'customer@luxora.lk' } });
  if (existingCust) {
    await prisma.servicePhoto.deleteMany({ where: { booking: { userId: existingCust.id } } });
    await prisma.booking.deleteMany({ where: { userId: existingCust.id } });
    await prisma.userSubscription.deleteMany({ where: { userId: existingCust.id } });
  }

  const plan = await prisma.subscriptionPlan.findFirst({ where: { title: 'Basic Package' } });
  assert.ok(plan, 'Plan must exist');

  const checkoutRes = await fetch(`${BASE}/payments/demo/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerLogin.token}`,
    },
    body: JSON.stringify({ plan_id: plan.id }),
  });
  assert.equal(checkoutRes.status, 201);
  const checkoutData = await checkoutRes.json();
  assert.ok(checkoutData.payment_id);

  // Complete payment
  const completeRes = await fetch(`${BASE}/payments/demo/${checkoutData.payment_id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerLogin.token}`,
    },
  });
  assert.equal(completeRes.status, 200);

  // Verify entitlement granted
  const entRes = await fetch(`${BASE}/subscriptions/entitlements`, {
    headers: { Authorization: `Bearer ${customerLogin.token}` },
  });
  assert.equal(entRes.status, 200);
  const entData = await entRes.json();
  assert.ok(entData.entitlements.length >= 1, 'Customer must have active entitlement');

  // Fetch Auto Care service
  const service = await prisma.service.findFirst({ where: { title: 'Wash + Vacuum' } });
  assert.ok(service, 'Service Wash + Vacuum must exist');

  const testBookingDate = `2026-11-${String(Math.floor(Math.random() * 25) + 1).padStart(2, '0')}`;

  // Customer creates booking
  const bookRes = await fetch(`${BASE}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerLogin.token}`,
    },
    body: JSON.stringify({
      service_id: service.id,
      booking_date: testBookingDate,
      booking_time: '10:00 AM',
      town: 'Colombo',
      address_street: '123 Galle Road',
      address_district: 'Colombo',
    }),
  });
  assert.equal(bookRes.status, 201);
  const bookData = await bookRes.json();
  assert.ok(bookData.booking_id);
  assert.equal(bookData.status.toUpperCase(), 'ASSIGNED', 'Should be auto-assigned to eligible Colombo Auto Care provider');
  assert.ok(bookData.start_pin, 'Initial response returns start PIN for customer');
  assert.equal(bookData.completion_pin, null, 'Initial response hides completion PIN until started');

  const bookingId = bookData.booking_id;
  const startPin = bookData.start_pin;

  // Duplicate request (idempotency check)
  const dupRes = await fetch(`${BASE}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerLogin.token}`,
    },
    body: JSON.stringify({
      service_id: service.id,
      booking_date: testBookingDate,
      booking_time: '10:00 AM',
      town: 'Colombo',
    }),
  });
  assert.equal(dupRes.status, 200, 'Duplicate booking returns 200 existing');
  const dupData = await dupRes.json();
  assert.equal(dupData.booking_id, bookingId);
  assert.equal(dupData.start_pin, undefined, 'Duplicate response must NEVER expose decrypted start_pin');
  assert.equal(dupData.completion_pin, undefined, 'Duplicate response must NEVER expose decrypted completion_pin');

  // Customer retrieves PINs via authorized endpoint
  const pinsRes = await fetch(`${BASE}/bookings/${bookingId}/pins`, {
    headers: { Authorization: `Bearer ${customerLogin.token}` },
  });
  assert.equal(pinsRes.status, 200);
  const pinsData = await pinsRes.json();
  assert.equal(pinsData.start_pin, startPin);
  assert.equal(pinsData.completion_pin, null, 'completion_pin hidden while ASSIGNED');

  // Attach required before photo
  await prisma.servicePhoto.create({
    data: {
      bookingId,
      kind: 'BEFORE',
      filePath: 'before_test.jpg',
      originalName: 'before.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    },
  });

  // Provider starts service with start PIN
  const startRes = await fetch(`${BASE}/bookings/${bookingId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerLogin.token}`,
    },
    body: JSON.stringify({ status: 'in_progress', pin_code: startPin }),
  });
  assert.equal(startRes.status, 200);
  const startData = await startRes.json();
  assert.equal(startData.status.toUpperCase(), 'IN_PROGRESS');

  // Customer retrieves revealed completion PIN after service is in progress
  const pinsInProgress = await fetch(`${BASE}/bookings/${bookingId}/pins`, {
    headers: { Authorization: `Bearer ${customerLogin.token}` },
  });
  const pinsInProgressData = await pinsInProgress.json();
  const completionPin = pinsInProgressData.completion_pin;
  assert.ok(completionPin, 'completion PIN is revealed when IN_PROGRESS');

  // Attach required after photo
  await prisma.servicePhoto.create({
    data: {
      bookingId,
      kind: 'AFTER',
      filePath: 'after_test.jpg',
      originalName: 'after.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    },
  });

  // Provider completes service with completion PIN
  const compRes = await fetch(`${BASE}/bookings/${bookingId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerLogin.token}`,
    },
    body: JSON.stringify({ status: 'completed', pin_code: completionPin }),
  });
  assert.equal(compRes.status, 200);
  const compData = await compRes.json();
  assert.equal(compData.status.toUpperCase(), 'COMPLETED');

  // Check provider earnings in DB
  const providerInDb = await prisma.provider.findUnique({ where: { userId: providerLogin.user.id } });
  assert.ok(Number(providerInDb.earnings) > 0, 'Provider earnings must be credited');
});

test('3. Admin Audit Trail Logging on Fresh DB', async () => {
  const adminLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@luxora.lk', password: 'luxora123' }),
  }).then(r => r.json());

  // Admin updates scheduling window
  const schedRes = await fetch(`${BASE}/admin/settings/scheduling`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`,
    },
    body: JSON.stringify({
      autoAssignmentCooldownHours: 5,
      autoAssignmentStartHour: 8,
      autoAssignmentEndHour: 18,
    }),
  });
  assert.equal(schedRes.status, 200);

  // Query audit logs
  const logsRes = await fetch(`${BASE}/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
  assert.equal(logsRes.status, 200);
  const logsData = await logsRes.json();
  assert.ok(Array.isArray(logsData), 'Audit log response must be an array');
  assert.ok(logsData.length >= 1, 'Audit log must record admin action');
  assert.equal(logsData[0].action, 'UPDATE_SCHEDULING_SETTINGS');
  assert.equal(logsData[0].admin.email, 'admin@luxora.lk');
});
