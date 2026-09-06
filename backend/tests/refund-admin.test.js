// V2 Slice 3 — admin refund API tests. In-process express app mounting the real
// admin router against the isolated test schema, with fake realtime clients to
// verify SSE delivery (same technique as auth-consistency.test.js).
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
import adminRouter from '../src/routes/admin.js';
import './assert-test-database.js';

const RND = crypto.randomUUID().slice(0, 8);
let app;
let listener;
let baseUrl;

let admin;
let customer;
let otherCustomer;
let plan;

const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET);
const authJson = async (user, apiPath, options = {}) => {
  const response = await fetch(`${baseUrl}${apiPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenFor(user)}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
};

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

const mkPayment = async (userId, captured = 100) => prisma.payment.create({
  data: {
    userId,
    planId: plan.id,
    gateway: 'PAYHERE',
    gatewayOrderId: `LUX-ADM-${RND}-${crypto.randomUUID().slice(0, 8)}`,
    idempotencyKey: `LUX-ADM-${RND}-${crypto.randomUUID().slice(0, 8)}`,
    expectedAmount: captured,
    expectedCurrency: 'LKR',
    capturedAmount: captured,
    capturedCurrency: 'LKR',
    status: 'COMPLETED',
  },
});

const mkRefund = async (paymentId, userId, amount = 100) => prisma.refundRequest.create({
  data: { paymentId, requestedBy: userId, amount, currency: 'LKR', status: 'REQUESTED', reason: `Admin slice ${RND}` },
});

before(async () => {
  admin = await prisma.user.create({
    data: { name: `AdmRef Admin ${RND}`, email: `admref.admin.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'ADMIN', active: true },
  });
  customer = await prisma.user.create({
    data: { name: `AdmRef Customer ${RND}`, email: `admref.cust.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  otherCustomer = await prisma.user.create({
    data: { name: `AdmRef Other ${RND}`, email: `admref.other.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  const category = await prisma.category.create({ data: { name: `AdmRefCat_${RND}` } });
  plan = await prisma.subscriptionPlan.create({
    data: { title: `AdmRef Plan ${RND}`, type: 'Auto Care', priceMonthly: 9000, durationDays: 30, features: '[]' },
  });
  void category;

  app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  listener = app.listen(0);
  baseUrl = `http://127.0.0.1:${listener.address().port}/api/admin`;

  adminSse = mkFakeClient();
  customerSse = mkFakeClient();
  strangerSse = mkFakeClient();
  registerRealtimeClient(admin.id, 'ADMIN', adminSse.res, () => Promise.resolve({ id: admin.id, role: 'ADMIN', active: true, tokenVersion: 0 }));
  registerRealtimeClient(customer.id, 'CUSTOMER', customerSse.res, () => Promise.resolve({ id: customer.id, role: 'CUSTOMER', active: true, tokenVersion: 0 }));
  registerRealtimeClient(otherCustomer.id, 'CUSTOMER', strangerSse.res, () => Promise.resolve({ id: otherCustomer.id, role: 'CUSTOMER', active: true, tokenVersion: 0 }));
});

after(async () => {
  unregisterRealtimeClient(adminSse.res);
  unregisterRealtimeClient(customerSse.res);
  unregisterRealtimeClient(strangerSse.res);
  listener.close();
  await prisma.$disconnect();
});

test('admin can list refunds; customer/provider/unauthenticated cannot', async () => {
  await mkRefund((await mkPayment(customer.id)).id, customer.id);
  const ok = await authJson(admin, '/refunds');
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.body));

  const asCustomer = await authJson(customer, '/refunds');
  assert.equal(asCustomer.status, 403);
  const asProvider = await authJson({ id: 999999, role: 'PROVIDER' }, '/refunds');
  assert.equal(asProvider.status, 403);
  const anon = await fetch(`${baseUrl}/refunds`);
  assert.equal(anon.status, 401);
});

test('list filters by status and customer search', async () => {
  const payment = await mkPayment(customer.id);
  await mkRefund(payment.id, customer.id, 25);
  const filtered = await authJson(admin, '/refunds?status=requested&customer=AdmRef');
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.every((r) => r.status === 'requested'));
  assert.ok(filtered.body.every((r) => /AdmRef/.test(r.customer_name || '')));
});

test('admin can move a refund through review -> approve -> process -> complete', async () => {
  const payment = await mkPayment(customer.id, 100);
  const subscription = await prisma.userSubscription.create({
    data: { userId: customer.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
  });
  const paymentWithSub = await prisma.payment.update({ where: { id: payment.id }, data: { subscriptionId: subscription.id } });
  const refund = await mkRefund(paymentWithSub.id, customer.id, 100);

  const review = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
  assert.equal(review.status, 200, review.text);
  const approve = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'approve' }) });
  assert.equal(approve.status, 200);
  const process = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'process', provider_ref: `PROV-A-${RND}` }) });
  assert.equal(process.status, 200);
  const complete = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'complete' }) });
  assert.equal(complete.status, 200, complete.text);

  const fresh = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(fresh.status, 'COMPLETED');
  const revoked = await prisma.userSubscription.findUnique({ where: { id: subscription.id } });
  assert.equal(revoked.status, 'refunded');
});

test('processing without a provider reference fails; reject without a note fails', async () => {
  const payment = await mkPayment(customer.id, 100);
  const refund = await mkRefund(payment.id, customer.id, 100);
  await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
  await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'approve' }) });

  const noRef = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'process' }) });
  assert.equal(noRef.status, 400);
  assert.match(noRef.body.error, /provider reference/i);

  const refund2 = await mkRefund((await mkPayment(customer.id, 100)).id, customer.id, 100);
  await authJson(admin, `/refunds/${refund2.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
  const noNote = await authJson(admin, `/refunds/${refund2.id}`, { method: 'PUT', body: JSON.stringify({ action: 'reject' }) });
  assert.equal(noNote.status, 400);
  assert.match(noNote.body.error, /admin note/i);
});

test('invalid transitions return 409 and leave state untouched', async () => {
  const payment = await mkPayment(customer.id, 100);
  const refund = await mkRefund(payment.id, customer.id, 100);
  const complete = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'complete' }) });
  assert.equal(complete.status, 409);
  const fresh = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.equal(fresh.status, 'REQUESTED');
});

test('duplicate provider references are rejected with 409', async () => {
  const p1 = await mkPayment(customer.id, 100);
  const p2 = await mkPayment(customer.id, 100);
  const a = await mkRefund(p1.id, customer.id, 100);
  const b = await mkRefund(p2.id, customer.id, 100);
  for (const r of [a, b]) {
    await authJson(admin, `/refunds/${r.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
    await authJson(admin, `/refunds/${r.id}`, { method: 'PUT', body: JSON.stringify({ action: 'approve' }) });
  }
  await authJson(admin, `/refunds/${a.id}`, { method: 'PUT', body: JSON.stringify({ action: 'process', provider_ref: `PROV-DUP2-${RND}` }) });
  const dup = await authJson(admin, `/refunds/${b.id}`, { method: 'PUT', body: JSON.stringify({ action: 'process', provider_ref: `PROV-DUP2-${RND}` }) });
  assert.equal(dup.status, 409);
  assert.match(dup.body.error, /already in use/i);
});

test('customer notification fires once per transition; admin note never leaks', async () => {
  const payment = await mkPayment(customer.id, 100);
  const refund = await mkRefund(payment.id, customer.id, 100);
  const notesFor = async () => prisma.notification.findMany({ where: { userId: customer.id, message: { contains: `#${refund.id}` } }, orderBy: { id: 'asc' } });

  await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review', admin_note: 'INTERNAL-ONLY-CHECK' }) });
  assert.equal((await notesFor()).length, 1);
  assert.equal(JSON.stringify((await notesFor()).map((n) => n.message)).includes('INTERNAL-ONLY-CHECK'), false, 'admin notes must not leak to customers');

  // Repeated identical action: 409, no new notification.
  const repeat = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
  assert.equal(repeat.status, 409);
  assert.equal((await notesFor()).length, 1);

  await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'approve' }) });
  assert.equal((await notesFor()).length, 2);
});

test('audit log rows are created for real transitions and not for no-ops', async () => {
  const payment = await mkPayment(customer.id, 100);
  const refund = await mkRefund(payment.id, customer.id, 100);
  const auditCount = async () => prisma.adminAuditLog.count({ where: { targetType: 'RefundRequest', targetId: String(refund.id) } });

  await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
  assert.equal(await auditCount(), 1);

  const repeat = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
  assert.equal(repeat.status, 409);
  assert.equal(await auditCount(), 1, 'no-op retries must not duplicate audit rows');
});

test('admin SSE receives REFUND_UPDATED; unrelated customers receive nothing', async () => {
  const payment = await mkPayment(customer.id, 100);
  const refund = await mkRefund(payment.id, customer.id, 100);
  adminSse.events.length = 0;
  customerSse.events.length = 0;
  strangerSse.events.length = 0;

  await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) });
  await new Promise((resolve) => setTimeout(resolve, 50));

  const adminRefundEvents = adminSse.events.filter((e) => e.includes('REFUND_UPDATED'));
  assert.equal(adminRefundEvents.length, 1, 'admin client receives exactly one REFUND_UPDATED');
  const payload = JSON.parse(adminRefundEvents[0].split('\ndata: ')[1]);
  assert.equal(payload.refundId, refund.id);
  assert.equal(payload.status, 'under_review');

  // The customer receives their own refund update via broadcastToUser.
  const customerRefundEvents = customerSse.events.filter((e) => e.includes('REFUND_UPDATED'));
  assert.equal(customerRefundEvents.length, 1);
  assert.equal(strangerSse.events.filter((e) => e.includes('REFUND_UPDATED')).length, 0);
});

test('failed transitions do not broadcast success events', async () => {
  const payment = await mkPayment(customer.id, 100);
  const refund = await mkRefund(payment.id, customer.id, 100);
  adminSse.events.length = 0;

  const bad = await authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'complete' }) });
  assert.equal(bad.status, 409);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(adminSse.events.filter((e) => e.includes('REFUND_UPDATED')).length, 0, 'no event for a failed transition');
});

test('concurrent admin transitions: exactly one effect', async () => {
  const payment = await mkPayment(customer.id, 100);
  const refund = await mkRefund(payment.id, customer.id, 100);
  const [a, b] = await Promise.allSettled([
    authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'review' }) }),
    authJson(admin, `/refunds/${refund.id}`, { method: 'PUT', body: JSON.stringify({ action: 'approve' }) }),
  ]);
  const statuses = [a, b].map((r) => (r.status === 'fulfilled' ? r.value.status : 0));
  assert.equal(statuses.filter((s) => s === 200).length, 1, 'exactly one transition wins');
  const fresh = await prisma.refundRequest.findUnique({ where: { id: refund.id } });
  assert.ok(['UNDER_REVIEW', 'APPROVED'].includes(fresh.status), `final state is valid: ${fresh.status}`);
});
