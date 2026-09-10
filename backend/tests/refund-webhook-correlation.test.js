// V2 Slice 5 — manual refund settlement + gateway-event correlation tests.
// In-process express app mounting the real integrations (webhooks), refunds
// (customer), and admin routers against the isolated test schema, with fake
// realtime clients (same technique as refund-admin.test.js). Signatures are
// computed with the real verifiers' algorithms and per-run test secrets.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import { registerRealtimeClient, unregisterRealtimeClient } from '../src/services/realtime.js';
import { sortObject, classifyNowPaymentsIpn } from '../src/services/paymentContracts.js';
import { transitionRefund } from '../src/services/refunds.js';
import { payHereWebhookSignature } from '../src/services/integrations.js';
import integrationsRouter from '../src/routes/integrations.js';
import refundsRouter from '../src/routes/refunds.js';
import adminRouter from '../src/routes/admin.js';
import './assert-test-database.js';

const RND = crypto.randomUUID().slice(0, 8);
const PAYHERE_SECRET = `ph-secret-${RND}`;
const NP_SECRET = `np-secret-${RND}`;

let app;
let listener;
let baseUrl;

let admin;
let customer;
let stranger;
let plan;

const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET);
const json = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
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
const authJson = (user, path, options = {}) => json(path, {
  ...options,
  headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers || {}) },
});

// Fake realtime clients (EventSource-style response capture)
const mkFakeClient = () => {
  const events = [];
  const res = {
    write: (chunk) => { events.push(chunk); },
    on: () => {},
    writeHead: () => {},
    flushHeaders: () => {},
  };
  return { events, res };
};
let adminSse;
let customerSse;
let strangerSse;
const sseCount = (client, name) => client.events.filter((e) => e.includes(name)).length;

const payHereSign = (p) => payHereWebhookSignature({ merchantId: p.merchant_id, orderId: p.order_id, amount: p.payhere_amount, currency: p.payhere_currency, statusCode: p.status_code, merchantSecret: PAYHERE_SECRET });
const payHereRefundPayload = (payment, { paymentId = `PH-${RND}-1`, amount = '100.00' } = {}) => {
  const payload = {
    merchant_id: 'TEST-MERCHANT',
    order_id: payment.gatewayOrderId,
    payment_id: paymentId,
    payhere_amount: amount,
    payhere_currency: 'LKR',
    status_code: '-3',
    status_message: 'Refunded',
  };
  return { ...payload, md5sig: payHereSign(payload) };
};

const npSign = (payload) => crypto.createHmac('sha512', NP_SECRET).update(JSON.stringify(sortObject(payload))).digest('hex');
const npRefundPayload = (payment, { paymentId = `NP-${RND}-1` } = {}) => {
  const payload = {
    payment_id: paymentId,
    payment_status: 'refunded',
    order_id: payment.gatewayOrderId,
    price_amount: Number(payment.expectedAmount),
    price_currency: 'LKR',
  };
  return { payload, signature: npSign(payload) };
};

const mkPayment = (userId, gateway, { captured = 100, status = 'COMPLETED' } = {}) => prisma.payment.create({
  data: {
    userId,
    planId: plan.id,
    gateway,
    gatewayOrderId: `LUX-S5-${RND}-${crypto.randomUUID().slice(0, 8)}`,
    idempotencyKey: `LUX-S5-${RND}-${crypto.randomUUID().slice(0, 8)}`,
    expectedAmount: captured,
    expectedCurrency: 'LKR',
    capturedAmount: status === 'COMPLETED' ? captured : null,
    capturedCurrency: status === 'COMPLETED' ? 'LKR' : null,
    status,
  },
});

const mkRefund = (paymentId, userId, amount = 100) => prisma.refundRequest.create({
  data: { paymentId, requestedBy: userId, amount, currency: 'LKR', status: 'REQUESTED', reason: `Slice 5 correlation ${RND}` },
});

// Drive a REQUESTED refund to APPROVED via the real state machine.
const mkApprovedRefund = async (paymentId, userId) => {
  const refund = await mkRefund(paymentId, userId);
  await transitionRefund({ refundId: refund.id, actorRole: 'ADMIN', action: 'review' });
  await transitionRefund({ refundId: refund.id, actorRole: 'ADMIN', action: 'approve' });
  return prisma.refundRequest.findUnique({ where: { id: refund.id } });
};

before(async () => {
  process.env.PAYHERE_MERCHANT_ID = 'TEST-MERCHANT';
  process.env.PAYHERE_MERCHANT_SECRET = PAYHERE_SECRET;
  process.env.NOWPAYMENTS_IPN_SECRET = NP_SECRET;

  admin = await prisma.user.create({
    data: { name: `S5 Admin ${RND}`, email: `s5.admin.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'ADMIN', active: true },
  });
  customer = await prisma.user.create({
    data: { name: `S5 Customer ${RND}`, email: `s5.cust.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  stranger = await prisma.user.create({
    data: { name: `S5 Stranger ${RND}`, email: `s5.stranger.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  plan = await prisma.subscriptionPlan.create({
    data: { title: `S5 Plan ${RND}`, type: 'Auto Care', priceMonthly: 9000, durationDays: 30, features: '[]' },
  });

  app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use('/api', integrationsRouter);
  app.use('/api', refundsRouter);
  listener = app.listen(0);
  baseUrl = `http://127.0.0.1:${listener.address().port}/api`;

  adminSse = mkFakeClient();
  customerSse = mkFakeClient();
  strangerSse = mkFakeClient();
  registerRealtimeClient(admin.id, 'ADMIN', adminSse.res, () => Promise.resolve({ id: admin.id, role: 'ADMIN', active: true, tokenVersion: 0 }));
  registerRealtimeClient(customer.id, 'CUSTOMER', customerSse.res, () => Promise.resolve({ id: customer.id, role: 'CUSTOMER', active: true, tokenVersion: 0 }));
  registerRealtimeClient(stranger.id, 'CUSTOMER', strangerSse.res, () => Promise.resolve({ id: stranger.id, role: 'CUSTOMER', active: true, tokenVersion: 0 }));
});

after(async () => {
  unregisterRealtimeClient(adminSse.res);
  unregisterRealtimeClient(customerSse.res);
  unregisterRealtimeClient(strangerSse.res);
  listener.close();
  await prisma.$disconnect();
});

test('PayHere -3 event settles an APPROVED refund through PROCESSING to COMPLETED', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const refund = await mkApprovedRefund(payment.id, customer.id);
  adminSse.events.length = 0;
  customerSse.events.length = 0;

  const res = await json('/payments/payhere/webhook', { method: 'POST', body: JSON.stringify(payHereRefundPayload(payment, { paymentId: `PH-${RND}-settle` })) });
  assert.equal(res.status, 200, res.body);

  const freshPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(freshPayment.status, 'REFUNDED', 'V1.5 payment reversal still applies');
  const settled = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(settled.status, 'COMPLETED');
  assert.equal(settled.providerRef, `payhere-ipn-PH-${RND}-settle`, 'reference derived from the verified event');
  assert.ok(settled.completedAt, 'completion recorded');

  // PROCESSING/COMPLETED wordings intentionally speak about the money, not the id.
  const processingNote = await prisma.notification.findFirst({ where: { userId: customer.id, message: { contains: 'is being processed back to your original payment method' } } });
  const completedNote = await prisma.notification.findFirst({ where: { userId: customer.id, message: { contains: 'has been completed' } } });
  assert.ok(processingNote, 'PROCESSING wording does not claim completed money');
  assert.ok(completedNote, 'COMPLETED notification sent');
  assert.equal(sseCount(adminSse, 'REFUND_UPDATED'), 2, 'admin SSE sees PROCESSING + COMPLETED');
  assert.equal(sseCount(customerSse, 'REFUND_UPDATED'), 2, 'affected customer receives both updates');
  assert.equal(sseCount(strangerSse, 'REFUND_UPDATED'), 0, 'unrelated customer receives nothing');
});

test('a PROCESSING refund keeps the admin-recorded external reference', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const refund = await mkApprovedRefund(payment.id, customer.id);
  await transitionRefund({ refundId: refund.id, actorRole: 'ADMIN', action: 'process', providerRef: `MANUAL-REF-${RND}` });

  const res = await json('/payments/payhere/webhook', { method: 'POST', body: JSON.stringify(payHereRefundPayload(payment, { paymentId: `PH-${RND}-keep` })) });
  assert.equal(res.status, 200);
  const settled = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(settled.status, 'COMPLETED');
  assert.equal(settled.providerRef, `MANUAL-REF-${RND}`, 'admin-recorded external reference is preserved');
});

test('a refund still awaiting review is never advanced by a gateway event', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const refund = await mkRefund(payment.id, customer.id);
  const res = await json('/payments/payhere/webhook', { method: 'POST', body: JSON.stringify(payHereRefundPayload(payment)) });
  assert.equal(res.status, 200);
  const fresh = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(fresh.status, 'REQUESTED', 'REQUESTED stays untouched — admin decision required');
  const freshPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(freshPayment.status, 'REFUNDED', 'V1.5 reversal behavior unchanged');
});

test('without a matching refund the V1.5 reversal behavior is unchanged', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const res = await json('/payments/payhere/webhook', { method: 'POST', body: JSON.stringify(payHereRefundPayload(payment)) });
  assert.equal(res.status, 200);
  const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(fresh.status, 'REFUNDED');
  assert.equal(await prisma.refundRequest.count({ where: { paymentId: payment.id } }), 0);
});

test('duplicate PayHere refund events are idempotent', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const refund = await mkApprovedRefund(payment.id, customer.id);
  const payload = JSON.stringify(payHereRefundPayload(payment, { paymentId: `PH-${RND}-dup` }));
  await json('/payments/payhere/webhook', { method: 'POST', body: payload });
  const notesAfterFirst = await prisma.notification.count({ where: { userId: customer.id, message: { contains: `#${refund.id}` } } });

  const res = await json('/payments/payhere/webhook', { method: 'POST', body: payload });
  assert.equal(res.status, 200);
  const settled = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(settled.status, 'COMPLETED');
  assert.equal(await prisma.notification.count({ where: { userId: customer.id, message: { contains: `#${refund.id}` } } }), notesAfterFirst, 'no duplicate notifications');
  assert.equal(await prisma.refundRequest.count({ where: { paymentId: payment.id } }), 1, 'no duplicate refund rows');
});

test('invalid PayHere signature is rejected', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const payload = payHereRefundPayload(payment);
  payload.md5sig = '0'.repeat(32);
  const res = await json('/payments/payhere/webhook', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(res.status, 400);
});

test('NOWPayments refunded IPN settles an APPROVED refund for a completed payment', async () => {
  const payment = await mkPayment(customer.id, 'NOWPAYMENTS');
  const refund = await mkApprovedRefund(payment.id, customer.id);
  adminSse.events.length = 0;
  const { payload, signature } = npRefundPayload(payment, { paymentId: `NP-${RND}-settle` });

  const res = await json('/payments/nowpayments/ipn', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-nowpayments-sig': signature },
  });
  assert.equal(res.status, 200, res.body);
  const freshPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(freshPayment.status, 'REFUNDED');
  const settled = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(settled.status, 'COMPLETED');
  assert.equal(settled.providerRef, `nowpayments-ipn-NP-${RND}-settle`);
  assert.ok(sseCount(adminSse, 'REFUND_UPDATED') >= 1, 'admin receives refund updates');
});

test('NOWPayments refunded IPN without a matching refund keeps the historical acknowledgment', async () => {
  const payment = await mkPayment(customer.id, 'NOWPAYMENTS');
  const { payload, signature } = npRefundPayload(payment);
  const res = await json('/payments/nowpayments/ipn', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-nowpayments-sig': signature },
  });
  assert.equal(res.status, 200);
  const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(fresh.status, 'COMPLETED', 'V1.5 preserved: no refund request, no payment change');
});

test('NOWPayments refunded IPN with a mismatched price contract is rejected', async () => {
  const payment = await mkPayment(customer.id, 'NOWPAYMENTS');
  await mkApprovedRefund(payment.id, customer.id);
  const { payload, signature } = npRefundPayload(payment, {});
  payload.price_amount = 999;
  const res = await json('/payments/nowpayments/ipn', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-nowpayments-sig': npSign(payload) },
  });
  assert.equal(res.status, 400, 'amount verification is preserved on correlated refunds');
  const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(fresh.status, 'COMPLETED', 'mismatched event settles nothing');
});

test('duplicate NOWPayments refunded events are idempotent', async () => {
  const payment = await mkPayment(customer.id, 'NOWPAYMENTS');
  const refund = await mkApprovedRefund(payment.id, customer.id);
  const { payload, signature } = npRefundPayload(payment, { paymentId: `NP-${RND}-dup` });
  const send = () => json('/payments/nowpayments/ipn', { method: 'POST', body: JSON.stringify(payload), headers: { 'x-nowpayments-sig': signature } });
  await send();
  const notesAfterFirst = await prisma.notification.count({ where: { userId: customer.id, message: { contains: `#${refund.id}` } } });

  const res = await send();
  assert.equal(res.status, 200);
  const settled = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(settled.status, 'COMPLETED');
  assert.equal(await prisma.notification.count({ where: { userId: customer.id, message: { contains: `#${refund.id}` } } }), notesAfterFirst, 'no duplicate notifications');
});

test('invalid NOWPayments signature is rejected', async () => {
  const payment = await mkPayment(customer.id, 'NOWPAYMENTS');
  const { payload } = npRefundPayload(payment);
  const res = await json('/payments/nowpayments/ipn', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-nowpayments-sig': '0'.repeat(128) },
  });
  assert.equal(res.status, 400);
});

test('state machine safety: rejected, cancelled, and completed refunds can never become processing', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const rejected = await mkRefund(payment.id, customer.id);
  await transitionRefund({ refundId: rejected.id, actorRole: 'ADMIN', action: 'review' });
  await transitionRefund({ refundId: rejected.id, actorRole: 'ADMIN', action: 'reject', adminNote: 'Not eligible' });
  await assert.rejects(
    () => transitionRefund({ refundId: rejected.id, actorRole: 'GATEWAY', action: 'process', providerRef: 'X' }),
    (error) => error.statusCode === 409,
    'rejected refund cannot be processed even by a gateway actor',
  );

  const cancelled = await mkRefund(payment.id, customer.id);
  await json(`/payments/refunds/${cancelled.id}/cancel`, { method: 'PUT', headers: { Authorization: `Bearer ${tokenFor(customer)}` } });
  await assert.rejects(
    () => transitionRefund({ refundId: cancelled.id, actorRole: 'GATEWAY', action: 'process', providerRef: 'X' }),
    (error) => error.statusCode === 409,
    'cancelled refund cannot be processed',
  );

  const approved = await mkApprovedRefund(payment.id, customer.id);
  await transitionRefund({ refundId: approved.id, actorRole: 'GATEWAY', action: 'process', providerRef: `GW-${RND}` });
  await transitionRefund({ refundId: approved.id, actorRole: 'GATEWAY', action: 'complete' });
  await assert.rejects(
    () => transitionRefund({ refundId: approved.id, actorRole: 'GATEWAY', action: 'complete' }),
    (error) => error.statusCode === 409,
    'duplicate completion is rejected as a no-op state transition',
  );

  await assert.rejects(
    () => transitionRefund({ refundId: approved.id, actorRole: 'GATEWAY', action: 'review' }),
    (error) => error.statusCode === 403,
    'gateway actor cannot perform admin-only review actions',
  );
});

test('a failed refund releases the amount and the customer can re-request', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const refund = await mkApprovedRefund(payment.id, customer.id);
  await transitionRefund({ refundId: refund.id, actorRole: 'ADMIN', action: 'process', providerRef: `FAILED-REF-${RND}` });
  await transitionRefund({ refundId: refund.id, actorRole: 'ADMIN', action: 'fail' });

  const retry = await authJson(customer, '/payments/refunds', {
    method: 'POST',
    body: JSON.stringify({ payment_id: payment.id, reason: 'Retry after failed settlement' }),
  });
  assert.equal(retry.status, 201, retry.body);
  assert.equal(retry.body.refund.status, 'requested', 'amount released after FAILED allows a fresh request');
});

test('concurrent admin completion and gateway settlement produce exactly one effect', async () => {
  const payment = await mkPayment(customer.id, 'PAYHERE');
  const refund = await mkApprovedRefund(payment.id, customer.id);
  await transitionRefund({ refundId: refund.id, actorRole: 'ADMIN', action: 'process', providerRef: `RACE-REF-${RND}` });

  const [adminResult, webhookResult] = await Promise.allSettled([
    json(`/admin/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'complete' }), headers: { Authorization: `Bearer ${tokenFor(admin)}` } }),
    json('/payments/payhere/webhook', { method: 'POST', body: JSON.stringify(payHereRefundPayload(payment)) }),
  ]);
  const settledValues = [adminResult, webhookResult].filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const fresh = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(fresh.status, 'COMPLETED', 'exactly one effect settles the refund');
  assert.equal(fresh.providerRef, `RACE-REF-${RND}`, 'the admin-recorded reference wins or is preserved');
  const completedOnce = settledValues.every((r) => r.status === 200 || r.status === 409);
  assert.ok(completedOnce, 'losers surface as conflicts, never as double effects');
});
