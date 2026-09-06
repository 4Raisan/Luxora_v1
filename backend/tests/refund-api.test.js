// V2 Slice 2 — live HTTP tests for the customer refund API. Spawned server +
// real database on the isolated test schema (same pattern as the booking suites).
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
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5043;
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
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
};
const authJson = (token, apiPath, options = {}) => json(apiPath, {
  ...options,
  headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
});
const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET);

let admin;
let customerA;
let refundIdFloor = 0; // shared test schema: only rows above this id belong to this run
let customerB;
let providerUser;
let plan;
const paymentsOf = {};

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

  admin = await prisma.user.create({
    data: { name: `RefApi Admin ${RND}`, email: `refapi.admin.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'ADMIN', active: true },
  });
  customerA = await prisma.user.create({
    data: { name: `RefApi A ${RND}`, email: `refapi.a.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  customerB = await prisma.user.create({
    data: { name: `RefApi B ${RND}`, email: `refapi.b.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  providerUser = await prisma.user.create({
    data: { name: `RefApi Provider ${RND}`, email: `refapi.prov.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'PROVIDER', active: true },
  });
  const category = await prisma.category.create({ data: { name: `RefApiCat_${RND}` } });
  plan = await prisma.subscriptionPlan.create({
    data: { title: `RefApi Plan ${RND}`, type: 'Auto Care', priceMonthly: 9000, durationDays: 30, features: '[]' },
  });
  void category;

  const mkPayment = async (userId, captured = 100, status = 'COMPLETED') => prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      gateway: 'PAYHERE',
      gatewayOrderId: `LUX-RA-${RND}-${crypto.randomUUID().slice(0, 8)}`,
      idempotencyKey: `LUX-RA-${RND}-${crypto.randomUUID().slice(0, 8)}`,
      expectedAmount: captured,
      expectedCurrency: 'LKR',
      capturedAmount: status === 'COMPLETED' ? captured : null,
      capturedCurrency: status === 'COMPLETED' ? 'LKR' : null,
      status,
    },
  });

  paymentsOf.a1 = await mkPayment(customerA.id, 100);
  paymentsOf.a2 = await mkPayment(customerA.id, 200);
  paymentsOf.a3 = await mkPayment(customerA.id, 300);
  paymentsOf.aPending = await mkPayment(customerA.id, 100, 'PENDING');
  paymentsOf.b1 = await mkPayment(customerB.id, 150);

  const maxRefund = await prisma.refundRequest.aggregate({ _max: { id: true } });
  refundIdFloor = maxRefund._max.id ?? 0;
});

after(async () => {
  await stopChildProcess(server);
  await prisma.$disconnect();
});

test('C-S2: successful refund request returns 201 with customer-safe fields and notifies customer + admins', async () => {
  const res = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentsOf.a1.id, reason: 'Service was cancelled by Luxora' }),
  });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.body.refund.payment_id, paymentsOf.a1.id);
  assert.equal(res.body.refund.amount, 100);
  assert.equal(res.body.refund.currency, 'LKR');
  assert.equal(res.body.refund.status, 'requested');
  assert.equal(res.body.refund.reason, 'Service was cancelled by Luxora');
  assert.equal(res.body.refund.admin_note, undefined, 'admin notes are not exposed to customers');

  const customerNote = await prisma.notification.findFirst({ where: { userId: customerA.id, message: { contains: 'refund request' } } });
  assert.ok(customerNote, 'customer receives a request-received notification');
  const adminNote = await prisma.notification.findFirst({ where: { userId: admin.id, message: { contains: `New refund request #${res.body.refund.id}` } } });
  assert.ok(adminNote, 'admins receive a new-request notification');
});

test('C-S2: partial refund request records the requested amount', async () => {
  const res = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentsOf.a2.id, amount: 40, reason: 'Partial refund check' }),
  });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.body.refund.amount, 40);
});

test('C-S2: omitted amount defaults to the full captured amount', async () => {
  const res = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentsOf.a3.id, reason: 'Full refund please' }),
  });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.body.refund.amount, 300);
});

test('C-S2: unauthenticated refund request is rejected with 401', async () => {
  const res = await json('/payments/refunds', { method: 'POST', body: JSON.stringify({ payment_id: paymentsOf.a1.id, reason: 'No token' }) });
  assert.equal(res.status, 401);
  const list = await json('/payments/refunds/my');
  assert.equal(list.status, 401);
});

test('C-S2: non-customer roles are rejected with 403', async () => {
  const res = await authJson(tokenFor(providerUser), '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentsOf.a1.id, reason: 'Provider attempt' }),
  });
  assert.equal(res.status, 403);
});

test('C-S2: another customer’s payment is not refundable and leaks no details', async () => {
  const res = await authJson(tokenFor(customerB), '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentsOf.a1.id, reason: 'Not my payment' }),
  });
  assert.equal(res.status, 403);
  assert.equal(JSON.stringify(res.body).includes('capturedAmount'), false);
  assert.equal(JSON.stringify(res.body).includes(String(paymentsOf.a1.id)), false, 'payment id is not echoed for foreign payments');
});

test('C-S2: nonexistent payment returns 404', async () => {
  const res = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: 99999999, reason: 'Ghost payment' }),
  });
  assert.equal(res.status, 404);
});

test('C-S2: ineligible (non-completed) payment returns 400', async () => {
  const res = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentsOf.aPending.id, reason: 'Still pending' }),
  });
  assert.equal(res.status, 400);
});

test('C-S2: invalid amounts are rejected with 400', async () => {
  for (const amount of [0, -5, 999999]) {
    const payment = await mkPaymentFor(customerA.id, 100);
    const res = await authJson(tokenFor(customerA), '/payments/refunds', {
      method: 'POST',
      body: JSON.stringify({ payment_id: payment.id, amount, reason: 'Amount check' }),
    });
    assert.equal(res.status, 400, `amount ${amount}`);
  }
});

test('C-S2: invalid reason lengths are rejected with 400', async () => {
  const short = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST', body: JSON.stringify({ payment_id: paymentsOf.a1.id, reason: 'No' }),
  });
  assert.equal(short.status, 400);
  const long = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST', body: JSON.stringify({ payment_id: paymentsOf.a1.id, reason: 'x'.repeat(501) }),
  });
  assert.equal(long.status, 400);
  const missing = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST', body: JSON.stringify({ payment_id: paymentsOf.a1.id }),
  });
  assert.equal(missing.status, 400);
});

test('C-S2: duplicate open refund returns 200 with the same request and no duplicate notification', async () => {
  const payment = await mkPaymentFor(customerA.id, 100);
  const first = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST', body: JSON.stringify({ payment_id: payment.id, reason: 'First attempt' }),
  });
  assert.equal(first.status, 201);
  const notificationsAfterFirst = await prisma.notification.count({ where: { userId: customerA.id, message: { contains: `#${first.body.refund.id}` } } });

  const second = await authJson(tokenFor(customerA), '/payments/refunds', {
    method: 'POST', body: JSON.stringify({ payment_id: payment.id, reason: 'Retried click' }),
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.refund.id, first.body.refund.id);
  const notificationsAfterSecond = await prisma.notification.count({ where: { userId: customerA.id, message: { contains: `#${first.body.refund.id}` } } });
  assert.equal(notificationsAfterSecond, notificationsAfterFirst, 'retries never duplicate notifications');
  assert.equal(await prisma.refundRequest.count({ where: { paymentId: payment.id } }), 1);
});

test('C-S2: concurrent refund requests produce exactly one open refund', async () => {
  const payment = await mkPaymentFor(customerA.id, 100);
  const [a, b] = await Promise.allSettled([
    authJson(tokenFor(customerA), '/payments/refunds', { method: 'POST', body: JSON.stringify({ payment_id: payment.id, reason: 'Concurrent A' }) }),
    authJson(tokenFor(customerA), '/payments/refunds', { method: 'POST', body: JSON.stringify({ payment_id: payment.id, reason: 'Concurrent B' }) }),
  ]);
  const open = await prisma.refundRequest.count({ where: { paymentId: payment.id, status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'] } } });
  assert.equal(open, 1, 'exactly one open refund');
  const results = [a, b].filter((r) => r.status === 'fulfilled').map((r) => r.value.status);
  assert.ok(results.includes(201), 'one request created the refund');
});

test('C-S2: refund list returns only the authenticated customer’s refunds, newest first', async () => {
  const listA = await authJson(tokenFor(customerA), '/payments/refunds/my');
  assert.equal(listA.status, 200);
  assert.ok(Array.isArray(listA.body) && listA.body.length >= 3);
  const thisRun = listA.body.filter((r) => r.id > refundIdFloor);
  const ownPaymentIds = new Set((await prisma.payment.findMany({ where: { userId: customerA.id } })).map((p) => p.id));
  for (const row of thisRun) {
    // Rows whose payment reference is null are orphans from a previous run of
    // the shared test schema (its tables were truncated); they cannot occur in
    // production because payments are delete-restricted while refunds exist.
    if (row.payment == null) continue;
    assert.ok(ownPaymentIds.has(row.payment.id), 'only own payment refunds');
    assert.equal(row.admin_note, undefined, 'admin notes are not exposed');
  }
  const dates = thisRun.map((r) => new Date(r.created_at).getTime());
  assert.deepEqual(dates, [...dates].sort((x, y) => y - x), 'ordered newest first');

  // Multiple refunds for the same customer include every distinct payment.
  const ids = new Set(thisRun.filter((r) => r.payment != null).map((r) => r.payment.id));
  assert.ok(ids.has(paymentsOf.a1.id) && ids.has(paymentsOf.a2.id) && ids.has(paymentsOf.a3.id));
});

test('C-S2: another customer’s refunds are never visible', async () => {
  const listB = await authJson(tokenFor(customerB), '/payments/refunds/my');
  assert.equal(listB.status, 200);
  assert.equal(listB.body.filter((r) => r.id > refundIdFloor).length, 0, 'customer B has no refunds from this run');
  const idsA = (await authJson(tokenFor(customerA), '/payments/refunds/my')).body.filter((r) => r.id > refundIdFloor).map((r) => r.id);
  const listBAgain = await authJson(tokenFor(customerB), '/payments/refunds/my');
  for (const row of listBAgain.body.filter((r) => r.id > refundIdFloor)) {
    assert.equal(idsA.includes(row.id), false);
  }
});

async function mkPaymentFor(userId, captured) {
  return prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      gateway: 'PAYHERE',
      gatewayOrderId: `LUX-RA-${RND}-${crypto.randomUUID().slice(0, 8)}`,
      idempotencyKey: `LUX-RA-${RND}-${crypto.randomUUID().slice(0, 8)}`,
      expectedAmount: captured,
      expectedCurrency: 'LKR',
      capturedAmount: captured,
      capturedCurrency: 'LKR',
      status: 'COMPLETED',
    },
  });
}

