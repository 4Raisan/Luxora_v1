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
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
import { prisma } from '../src/config/prisma.js';

const PORT = 5017;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RND = crypto.randomUUID().slice(0, 8);
// Fake EasySendSMS/Resend credentials so no external service is actually called and
// no real OTP/email cost is incurred during abuse tests.
const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'demo',
  EASYSENDSMS_API_KEY: 'fake-key',
  EASYSENDSMS_SENDER_ID: 'LUXORA',
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
  headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
});

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { cwd: process.cwd(), env: SERVER_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
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
    await prisma.refundRequest.deleteMany({ where: { user: { email: { contains: suffix } } } });
    // bookings reference users/reviews with RESTRICT, so remove dependents first
    await prisma.review.deleteMany({ where: { booking: { user: { email: { contains: suffix } } } } });
    await prisma.complaint.deleteMany({ where: { booking: { user: { email: { contains: suffix } } } } });
    await prisma.booking.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.payment.deleteMany({ where: { gatewayOrderId: { contains: suffix } } });
  } catch (error) { console.error('test cleanup failed:', error.message); }
  if (server) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      server.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await prisma.$disconnect();
});

async function login(email, password = 'luxora123') {
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
    authJson(admin, '/admin/refunds'),
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
  const proof = jwt.sign({ scope: 'provider_phone_verified', phone: '+94771234567' }, process.env.JWT_SECRET);
  const { status, body } = await json('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pending Provider', email, password: 'secret123', phone: '0771234567', role: 'provider', phone_verification_token: proof, category: 'Auto Care' }),
  });
  assert.equal(status, 201);
  const token = body.token;

  // Login must also be blocked while KYC is pending
  const pendingLogin = await json('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secret123' }) });
  assert.equal(pendingLogin.status, 403);

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

  // A rejected provider stays locked out
  const rejectEmail = `rejected-${RND}@test.com`;
  const rejectProof = jwt.sign({ scope: 'provider_phone_verified', phone: '+94771234568' }, process.env.JWT_SECRET);
  const rejected = await json('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Rejected Provider', email: rejectEmail, password: 'secret123', phone: '0771234568', role: 'provider', phone_verification_token: rejectProof, category: 'Auto Care' }) });
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

test('B5: OTP and email senders are rate limited and return generic errors', async () => {  // 5 allowed, 6th must hit 429 — and none of the responses may leak provider details
  let sawLimit = false;
  let sawGenericError = false;
  for (let i = 0; i < 6; i += 1) {
    const { status, body } = await json('/auth/register/phone/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0771112233' }) });
    if (status === 429) { sawLimit = true; break; }
    assert.equal(status, 502); // fake EasySendSMS credentials -> upstream failure
    assert.equal(body.error, 'Could not send verification code'); // sanitized
    assert.ok(!JSON.stringify(body).includes('EasySendSMS'));
    sawGenericError = true;
  }
  assert.ok(sawLimit, 'phone OTP send was not rate limited');
  assert.ok(sawGenericError, 'expected upstream failure never exercised the sanitized path');

  const customer = await login('customer@luxora.lk');
  let emailLimited = false;
  for (let i = 0; i < 6; i += 1) {
    const { status } = await authJson(customer, '/email', { method: 'POST', body: JSON.stringify({ to: 'customer@luxora.lk', subject: 's', html: '<p>s</p>' }) });
    if (status === 429) { emailLimited = true; break; }
    assert.ok([200, 502].includes(status));
  }
  assert.ok(emailLimited, 'email endpoint was not rate limited');

  let otpLimited = false;
  for (let i = 0; i < 6; i += 1) {
    const { status } = await authJson(customer, '/otp/send', { method: 'POST', body: JSON.stringify({ phone: '+94771112233' }) });
    if (status === 429) { otpLimited = true; break; }
  }
  assert.ok(otpLimited, 'authenticated OTP send was not rate limited');
});

test('B8 + B12 + lifecycle: demo purchase, PayHere refund webhook revokes entitlements idempotently, money stays exact', async () => {
  const email = `flow-${RND}@test.com`;
  const { body: reg } = await json('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Flow Customer', email, password: 'secret123', town: 'Colombo' }) });
  const token = reg.token;

  // B12: demo checkout serializes money as JSON numbers with exact values
  const order = await authJson(token, '/payments/demo/order', { method: 'POST', body: JSON.stringify({ plan_id: 1 }) });
  assert.equal(order.status, 201);
  assert.equal(typeof order.body.plan.amount, 'number');
  assert.equal(order.body.plan.amount, 12000);
  const complete = await authJson(token, `/payments/demo/${order.body.payment_id}/complete`, { method: 'POST', body: JSON.stringify({ outcome: 'success' }) });
  assert.equal(complete.status, 200);

  // Full booking lifecycle: book -> claim -> photo -> PIN start -> photo -> PIN complete -> review
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const booking = await authJson(token, '/bookings', { method: 'POST', body: JSON.stringify({ service_id: 1, booking_date: tomorrow, booking_time: '09:00' }) });
  assert.ok([200, 201].includes(booking.status), JSON.stringify(booking.body));
  assert.ok(booking.body.start_pin && booking.body.completion_pin);
  const bookingId = booking.body.booking_id;

  const provider = await login('provider@luxora.lk');
  if (booking.body.status === 'pending') {
    const claim = await authJson(provider, `/bookings/${bookingId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'assigned' }) });
    assert.equal(claim.status, 200);
  }
  const photoForm = (kind) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('photos', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9])], { type: 'image/png' }), `${kind}.png`);
    return form;
  };
  assert.equal((await authJson(provider, `/bookings/${bookingId}/photos`, { method: 'POST', body: photoForm('BEFORE') })).status, 201);
  const start = await authJson(provider, `/bookings/${bookingId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'in_progress', pin_code: booking.body.start_pin }) });
  assert.equal(start.status, 200);
  assert.equal((await authJson(provider, `/bookings/${bookingId}/photos`, { method: 'POST', body: photoForm('AFTER') })).status, 201);
  const finish = await authJson(provider, `/bookings/${bookingId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'completed', pin_code: booking.body.completion_pin }) });
  assert.equal(finish.status, 200);
  const review = await authJson(token, '/reviews', { method: 'POST', body: JSON.stringify({ booking_id: bookingId, rating: 5, comment: `flow-${RND}` }) });
  assert.equal(review.status, 201);

  // B12: provider payout is exact Decimal math serialized as a number
  const earnings = await authJson(provider, '/provider/earnings');
  assert.equal(earnings.status, 200);
  assert.equal(typeof earnings.body.earnings, 'number');
  const historyRow = earnings.body.history.find((h) => h.id === bookingId);
  assert.ok(historyRow, 'completed booking missing from earnings history');
  assert.equal(historyRow.job_earnings, 4500 * 0.85);

  // B8: simulate a real PayHere charge then refund webhook for a gateway payment
  const payment = await prisma.payment.create({ data: { userId: reg.user.id, planId: 1, gateway: 'PAYHERE', gatewayOrderId: `LUX-PH-${RND}-1`, idempotencyKey: `LUX-PH-${RND}-1`, expectedAmount: 12000, expectedCurrency: 'LKR' } });
  const md5 = (value) => crypto.createHash('md5').update(value).digest('hex').toUpperCase();
  const sign = (statusCode, amount) => md5(`${process.env.PAYHERE_MERCHANT_ID}LUX-PH-${RND}-1${amount}LKR${statusCode}${md5(process.env.PAYHERE_MERCHANT_SECRET)}`);
  const webhook = (statusCode, amount) => json('/payments/payhere/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant_id: process.env.PAYHERE_MERCHANT_ID, order_id: `LUX-PH-${RND}-1`, payhere_amount: amount, payhere_currency: 'LKR', status_code: String(statusCode), md5sig: sign(statusCode, amount) }) });

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
});
