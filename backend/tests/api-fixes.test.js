// Integration tests for the security/durability fixes. Boots the real API on a
// test port against the configured PostgreSQL database and exercises each fix
// over HTTP: credential-field leaks (B1), pre-KYC provider access (B3), sender
// rate limiting + sanitized errors (B5), refund entitlement revocation and
// webhook idempotency (B8), spoofed upload rejection (B11) and Decimal money
// serialization (B12), plus the full booking lifecycle.
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
import { stopChildProcess } from './helpers/stop-child-process.js';
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5017;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RND = crypto.randomUUID().slice(0, 8);
// Empty Resend credentials prevent external email cost during abuse tests.
const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'demo',
  RESEND_API_KEY: '',
  GOOGLE_CLIENT_ID: '',
  PAYHERE_MERCHANT_ID: process.env.PAYHERE_MERCHANT_ID || '123456',
  PAYHERE_MERCHANT_SECRET: process.env.PAYHERE_MERCHANT_SECRET || 'sandbox_secret_key_123',
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
  headers: { ...options.headers, Authorization: `Bearer ${token}`, ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
});

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: 'ignore' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) break;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (attempt === 59) throw new Error('Test server failed to start');
  }
});

after(async () => {
  const suffix = RND;
  // Remove this run's test users (cascades their bookings/subscriptions/etc.)
  try {
    // bookings reference users/reviews with RESTRICT, so remove dependents first
    await prisma.review.deleteMany({ where: { booking: { user: { email: { contains: suffix } } } } });
    await prisma.complaint.deleteMany({ where: { booking: { user: { email: { contains: suffix } } } } });
    await prisma.booking.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.payment.deleteMany({ where: { gatewayOrderId: { contains: suffix } } });
  } catch (error) { console.error('test cleanup failed:', error.message); }
  await stopChildProcess(server);
  await prisma.$disconnect();
});

const demoPasswordFor = (email) => {
  if (email === 'customer@luxora.lk') return process.env.CUSTOMER_PASSWORD || 'luxora123';
  if (email === 'provider@luxora.lk') return process.env.PROVIDER_PASSWORD || 'luxora123';
  if (email === 'admin@luxora.lk') return process.env.ADMIN_PASSWORD || 'luxora123';
  return 'luxora123';
};
async function login(email, password = demoPasswordFor(email)) {
  const { status, body } = await json('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(status, 200, `login failed for ${email}`);
  return body.token;
}

test('B1: no credential fields in any list/dashboard API response', async () => {
  const customer = await login('customer@luxora.lk');
  const admin = await login('admin@luxora.lk');
  const provider = await login('provider@luxora.lk');
  const responses = await Promise.all([
    authJson(customer, '/customer/dashboard'),
    authJson(customer, '/bookings/my'),
    authJson(provider, '/bookings/assigned'),
    authJson(admin, '/admin/providers'),
    authJson(admin, '/admin/bookings'),
    authJson(admin, '/admin/complaints'),
    authJson(admin, '/admin/users'),
  ]);
  for (const { status, text } of responses) {
    assert.equal(status, 200);
    assert.ok(!text.includes('passwordHash'), 'passwordHash leaked');
    assert.ok(!text.includes('password'), 'password field leaked');
    assert.ok(!text.includes('startPinHash'), 'PIN hash leaked');
    assert.ok(!text.includes('customerStartPinCipher'), 'PIN cipher leaked');
    assert.ok(!text.includes('tokenHash'), 'reset token hash leaked');
  }
});

test('B3: pre-KYC provider token gets no operational access, but can upload KYC documents', async () => {
  const email = `pending-${RND}@test.com`;
  const { status, body } = await json('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pending Provider', email, password: 'secret123', phone: '0771234567', town: 'Colombo', role: 'provider', category: 'Auto Care' }),
  });
  assert.equal(status, 201);
  const token = body.token;

  // PENDING/REJECTED providers can log in to view KYC status and upload documents
  const pendingLogin = await json('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secret123' }) });
  assert.equal(pendingLogin.status, 200);
  assert.ok(pendingLogin.body.token);
  assert.equal(pendingLogin.body.provider?.kycStatus, 'PENDING');

  // Operational provider routes must all reject the pre-KYC token server-side
  assert.equal((await authJson(token, '/provider/availability')).status, 403);
  assert.equal((await authJson(token, '/bookings/assigned')).status, 403);
  assert.equal((await authJson(token, '/bookings/99/schedule', { method: 'PUT', body: JSON.stringify({ expected_end_time: new Date().toISOString() }) })).status, 403);
  assert.equal((await authJson(token, '/bookings/1/status', { method: 'PUT', body: JSON.stringify({ status: 'assigned' }) })).status, 403);

  // KYC document upload is intentionally still possible (registration flow)
  const form = new FormData();
  form.append('document_type', 'NIC');
  form.append('documents', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])], { type: 'image/png' }), 'nic.png');
  const upload = await authJson(token, '/provider/kyc-documents', { method: 'POST', body: form });
  assert.equal(upload.status, 201);

  // After admin approval the same routes open up
  const admin = await login('admin@luxora.lk');
  const providers = (await authJson(admin, '/admin/providers')).body;
  const created = providers.find((p) => p.email === email);
  assert.ok(created, 'created provider not listed');
  const approval = await authJson(admin, `/admin/providers/${created.id}/kyc`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
  assert.equal(approval.status, 200);

  const approvedLogin = await json('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secret123' }) });
  assert.equal(approvedLogin.status, 200);
  assert.equal((await authJson(approvedLogin.body.token, '/bookings/assigned')).status, 200);

  const categories = await authJson(approvedLogin.body.token, '/provider/service-categories', {
    method: 'PUT', body: JSON.stringify({ categories: ['Auto Care', 'Garden Care', 'Pet Care'] }),
  });
  assert.equal(categories.status, 200);
  assert.deepEqual(categories.body.categories, ['Auto Care', 'Garden Care', 'Pet Care']);
  const availability = await authJson(approvedLogin.body.token, '/provider/availability');
  assert.deepEqual(availability.body.categories, ['Auto Care', 'Garden Care', 'Pet Care']);
  assert.equal((await authJson(approvedLogin.body.token, '/provider/service-categories', {
    method: 'PUT', body: JSON.stringify({ categories: [] }),
  })).status, 400);

  // A rejected provider stays locked out
  const rejectEmail = `rejected-${RND}@test.com`;
  const rejected = await json('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Rejected Provider', email: rejectEmail, password: 'secret123', phone: '0771234568', town: 'Colombo', role: 'provider', category: 'Auto Care' }) });
  assert.equal(rejected.status, 201);
  assert.equal((await authJson(rejected.body.token, '/bookings/assigned')).status, 403);
});

test('Google sign-in endpoint is guarded when unconfigured', async () => {
  // The test server runs without GOOGLE_CLIENT_ID, so the endpoint must refuse
  // cleanly instead of accepting unverified credentials.
  const unconfigured = await json('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'fake-token' }) });
  assert.equal(unconfigured.status, 503);
  assert.equal(unconfigured.body.error, 'Google sign-in is not configured');
  // Route must exist (not the API 404) and never leaks stack details.
  assert.ok(!String(unconfigured.body.error).includes('fetch'));
});

test('Profile phone number updates directly as standard contact info without OTP', async () => {
  const email = `profile-phone-${RND}@test.com`;
  const { status, body: registration } = await json('/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Phone Profile', email, password: 'secret123' }),
  });
  assert.equal(status, 201);
  const token = registration.token;
  const changed = await authJson(token, '/profile', { method: 'PUT', body: JSON.stringify({ phone: '0771234567' }) });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.phone, '+94771234567');

  const profile = await authJson(token, '/profile');
  assert.equal(profile.status, 200);
  assert.equal(profile.body.phone, '+94771234567');

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const notification = await prisma.notification.create({ data: { userId: user.id, message: 'dismiss me' } });
  assert.equal((await authJson(token, `/notifications/${notification.id}`, { method: 'DELETE' })).status, 200);
  assert.equal(await prisma.notification.count({ where: { id: notification.id } }), 0);
});

test('Entitlement reads do not renew due demo subscriptions', async () => {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });
  assert.ok(plan, 'an active subscription plan is required for this test');
  const user = await prisma.user.create({ data: { name: 'Read-only Entitlements', email: `read-only-${RND}@test.com`, passwordHash: 'not-used-in-this-test' } });
  const dueAt = new Date(Date.now() - 60_000);
  const subscription = await prisma.userSubscription.create({
    data: { userId: user.id, planId: plan.id, startDate: new Date(dueAt.getTime() - 30 * 86400000), endDate: dueAt, status: 'active', autoRenew: true, renewalIntervalDays: 30, nextRenewalDate: dueAt },
  });
  const token = jwt.sign({ id: user.id, role: 'CUSTOMER' }, process.env.JWT_SECRET);

  const response = await authJson(token, '/subscriptions/entitlements');
  assert.equal(response.status, 200);
  assert.equal(response.body.renewed, 0);
  const unchanged = await prisma.userSubscription.findUnique({ where: { id: subscription.id } });
  assert.equal(unchanged.status, 'active');
  assert.equal(unchanged.autoRenew, true);
  assert.equal((await prisma.payment.count({ where: { userId: user.id } })), 0);
});

test('B5: Email sender is rate limited', async () => {
  const customer = await login('customer@luxora.lk');
  let emailLimited = false;
  for (let i = 0; i < 6; i += 1) {
    const { status } = await authJson(customer, '/email', { method: 'POST', body: JSON.stringify({ to: 'customer@luxora.lk', subject: 's', html: '<p>s</p>' }) });
    if (status === 429) { emailLimited = true; break; }
    assert.ok([200, 502].includes(status));
  }
  assert.ok(emailLimited, 'email endpoint was not rate limited');
});

test('B8 + B12 + lifecycle: demo purchase, PayHere refund webhook revokes entitlements idempotently, money stays exact', async () => {
  const email = `flow-${RND}@test.com`;
  const { body: reg } = await json('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Flow Customer', email, password: 'secret123', town: 'Colombo' }) });
  const token = reg.token;

  // B12: demo checkout serializes money as JSON numbers with exact values
  const order = await authJson(token, '/payments/demo/order', { method: 'POST', body: JSON.stringify({ plan_id: 1 }) });
  assert.equal(order.status, 201);
  assert.equal(typeof order.body.plan.amount, 'number');
  assert.ok([4250, 5000].includes(order.body.plan.amount), `Expected 5000 or 4250, got ${order.body.plan.amount}`);
  const complete = await authJson(token, `/payments/demo/${order.body.payment_id}/complete`, { method: 'POST', body: JSON.stringify({ outcome: 'success' }) });
  assert.equal(complete.status, 200);
  assert.equal(complete.body.receipt.plan_id, 1);
  assert.equal(complete.body.receipt.coins_granted, 1);
  assert.ok(complete.body.subscription.id);
  assert.ok(Array.isArray(complete.body.entitlement_snapshot));
  assert.ok(complete.body.entitlement_snapshot.some((item) => item.remaining_units >= 1));

  // Full booking lifecycle: book (server auto-assigns) -> photo -> PIN start -> photo -> PIN complete -> review
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const booking = await authJson(token, '/bookings', { method: 'POST', body: JSON.stringify({ service_id: 1, booking_date: tomorrow, booking_time: '09:00' }) });
  assert.ok([200, 201].includes(booking.status), JSON.stringify(booking.body));
  assert.ok(booking.body.start_pin);
  assert.equal(booking.body.completion_pin, null, 'completion_pin hidden until service start');
  const bookingId = booking.body.booking_id;

  const provider = await login('provider@luxora.lk');
  assert.equal(booking.body.status, 'assigned');
  const photoForm = (kind) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('photos', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9])], { type: 'image/png' }), `${kind}.png`);
    return form;
  };
  assert.equal((await authJson(provider, `/bookings/${bookingId}/photos`, { method: 'POST', body: photoForm('BEFORE') })).status, 201);
  const start = await authJson(provider, `/bookings/${bookingId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'in_progress', pin_code: booking.body.start_pin }) });
  assert.equal(start.status, 200);

  // Customer fetches revealed completion PIN
  const customerPins = await authJson(token, `/bookings/${bookingId}/pins`);
  assert.equal(customerPins.status, 200);
  assert.ok(customerPins.body.completion_pin, 'completion_pin is revealed after start');

  assert.equal((await authJson(provider, `/bookings/${bookingId}/photos`, { method: 'POST', body: photoForm('AFTER') })).status, 201);
  const finish = await authJson(provider, `/bookings/${bookingId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'completed', pin_code: customerPins.body.completion_pin }) });
  assert.equal(finish.status, 200);
  const review = await authJson(token, '/reviews', { method: 'POST', body: JSON.stringify({ booking_id: bookingId, rating: 5, comment: `flow-${RND}` }) });
  assert.equal(review.status, 201);

  // B12: provider payout is exact Decimal math serialized as a number
  const earnings = await authJson(provider, '/provider/earnings');
  assert.equal(earnings.status, 200);
  assert.equal(typeof earnings.body.earnings, 'number');
  const historyRow = earnings.body.history.find((h) => h.id === bookingId);
  assert.ok(historyRow, 'completed booking missing from earnings history');
  assert.equal(historyRow.job_earnings, 2500);

  // B8: simulate a real PayHere charge then refund webhook for a gateway payment
  const payment = await prisma.payment.create({ data: { userId: reg.user.id, planId: 1, gateway: 'PAYHERE', gatewayOrderId: `LUX-PH-${RND}-1`, idempotencyKey: `LUX-PH-${RND}-1`, expectedAmount: 12000, expectedCurrency: 'LKR' } });
  const merchantId = process.env.PAYHERE_MERCHANT_ID || '123456';
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'sandbox_secret_key_123';
  const md5 = (value) => crypto.createHash('md5').update(String(value || '')).digest('hex').toUpperCase();
  const sign = (statusCode, amount) => md5(`${merchantId}LUX-PH-${RND}-1${amount}LKR${statusCode}${md5(merchantSecret)}`);
  const webhook = (statusCode, amount) => json('/payments/payhere/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant_id: merchantId, order_id: `LUX-PH-${RND}-1`, payhere_amount: amount, payhere_currency: 'LKR', status_code: String(statusCode), md5sig: sign(statusCode, amount) }) });

  assert.equal((await webhook(2, '12000.00')).status, 200);
  const charged = await prisma.payment.findUnique({ where: { id: payment.id }, include: { subscription: true } });
  assert.equal(charged.status, 'COMPLETED');
  assert.equal(charged.subscription.status, 'active');

  // Refund webhook: payment refunded AND subscription revoked atomically...
  assert.equal((await webhook(-3, '12000.00')).status, 200);
  const refunded = await prisma.payment.findUnique({ where: { id: payment.id }, include: { subscription: true } });
  assert.equal(refunded.status, 'REFUNDED');
  assert.equal(refunded.subscription.status, 'refunded');
  assert.equal(refunded.subscription.autoRenew, false);

  // ...and repeated webhook deliveries stay idempotent (no duplicate notifications)
  const notificationsBefore = await prisma.notification.count({ where: { userId: reg.user.id, message: { contains: 'refunded' } } });
  assert.equal((await webhook(-3, '12000.00')).status, 200);
  assert.equal((await webhook(-3, '12000.00')).status, 200);
  const notificationsAfter = await prisma.notification.count({ where: { userId: reg.user.id, message: { contains: 'refunded' } } });
  assert.equal(notificationsAfter, notificationsBefore);

  // The refunded package no longer grants entitlements
  const entitlements = await authJson(token, '/subscriptions/entitlements');
  assert.equal(entitlements.status, 200);
  for (const entry of entitlements.body.entitlements) {
    assert.ok(entry.subscriptions.every((s) => s.subscription_id !== charged.subscriptionId), 'refunded subscription still listed as bookable');
  }

  // Mismatched amounts are rejected (existing amount-revalidation still holds):
  // a tampered charge against a still-PENDING payment must not settle it.
  const pendingPayment = await prisma.payment.create({ data: { userId: reg.user.id, planId: 1, gateway: 'PAYHERE', gatewayOrderId: `LUX-PH-${RND}-2`, idempotencyKey: `LUX-PH-${RND}-2`, expectedAmount: 12000, expectedCurrency: 'LKR' } });
  const tamperedSign = (statusCode, amount) => md5(`${process.env.PAYHERE_MERCHANT_ID}LUX-PH-${RND}-2${amount}LKR${statusCode}${md5(process.env.PAYHERE_MERCHANT_SECRET)}`);
  const tampered = await json('/payments/payhere/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant_id: process.env.PAYHERE_MERCHANT_ID, order_id: `LUX-PH-${RND}-2`, payhere_amount: '1.00', payhere_currency: 'LKR', status_code: '2', md5sig: tamperedSign(2, '1.00') }) });
  assert.notEqual(tampered.status, 200);
  const stillPending = await prisma.payment.findUnique({ where: { id: pendingPayment.id } });
  assert.notEqual(stillPending.status, 'COMPLETED');
});

test('B11: spoofed uploads with mismatched content are rejected server-side', async () => {
  const provider = await login('provider@luxora.lk');
  const spoof = new FormData();
  spoof.append('document_type', 'NIC');
  spoof.append('documents', new Blob([Buffer.from('#!/bin/sh\nrm -rf /', 'utf8')], { type: 'image/jpeg' }), 'malicious.jpg');
  assert.equal((await authJson(provider, '/provider/kyc-documents', { method: 'POST', body: spoof })).status, 415);

  const exe = new FormData();
  exe.append('document_type', 'SELFIE');
  exe.append('documents', new Blob([Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(64)])], { type: 'application/pdf' }), 'dropper.pdf');
  assert.equal((await authJson(provider, '/provider/kyc-documents', { method: 'POST', body: exe })).status, 415);

  const genuine = new FormData();
  genuine.append('document_type', 'NIC');
  genuine.append('documents', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46])], { type: 'image/jpeg' }), 'id.jpg');
  assert.equal((await authJson(provider, '/provider/kyc-documents', { method: 'POST', body: genuine })).status, 201);

  const oversized = new FormData();
  oversized.append('document_type', 'NIC');
  oversized.append('documents', new Blob([Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)])], { type: 'image/jpeg' }), 'oversized.jpg');
  assert.equal((await authJson(provider, '/provider/kyc-documents', { method: 'POST', body: oversized })).status, 413);
});
