// V2 Slice 1 — refund ledger core tests. Exercises the real database on the
// isolated test schema: creation eligibility, amount safety, state machine,
// concurrency (advisory locks), idempotency, and V1 payment compatibility.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { createRefundRequest, transitionRefund, OPEN_REFUND_STATUSES } from '../src/services/refunds.js';
import './assert-test-database.js';

const RND = crypto.randomUUID().slice(0, 8);
let admin;
let customer;
let plan;

const mkPayment = async ({ userId, status = 'COMPLETED', captured = 100, subscriptionId = null, gateway = 'PAYHERE' }) =>
  prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      gateway,
      gatewayOrderId: `LUX-TEST-${RND}-${crypto.randomUUID().slice(0, 8)}`,
      idempotencyKey: `LUX-TEST-${RND}-${crypto.randomUUID().slice(0, 8)}`,
      expectedAmount: captured,
      expectedCurrency: 'LKR',
      capturedAmount: status === 'COMPLETED' ? captured : null,
      capturedCurrency: status === 'COMPLETED' ? 'LKR' : null,
      status,
      subscriptionId,
    },
  });

const mkSubscription = (userId) => prisma.userSubscription.create({
  data: { userId, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'active' },
});

const statusCode = (result) => result.statusCode ?? (result.code === 'P2034' ? 409 : 500);

before(async () => {
  admin = await prisma.user.create({
    data: { name: `Refund Admin ${RND}`, email: `refund.admin.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'ADMIN', active: true },
  });
  customer = await prisma.user.create({
    data: { name: `Refund Customer ${RND}`, email: `refund.customer.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true, town: 'Colombo', addressDistrict: 'Western' },
  });
  const category = await prisma.category.create({ data: { name: `RefundCat_${RND}` } });
  plan = await prisma.subscriptionPlan.create({
    data: { title: `Refund Plan ${RND}`, type: 'Auto Care', priceMonthly: 9000, durationDays: 30, features: '[]' },
    include: { entitlements: true },
  });
  void category;
});

after(async () => {
  await prisma.$disconnect();
});

test('C-S1: valid creation defaults to the full refundable amount and enters REQUESTED', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const refund = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, reason: 'Broken service' });
  assert.equal(refund.status, 'REQUESTED');
  assert.equal(Number(refund.amount), 100);
  assert.equal(refund.currency, 'LKR');
  assert.equal(refund.requestedBy, customer.id);
  assert.equal(refund.decidedAt, null);
});

test('C-S1: nonexistent and non-completed payments are ineligible', async () => {
  await assert.rejects(
    createRefundRequest({ paymentId: 99999999, requestedBy: customer.id }),
    (e) => e.statusCode === 404,
  );
  const pending = await mkPayment({ userId: customer.id, status: 'PENDING' });
  await assert.rejects(
    createRefundRequest({ paymentId: pending.id, requestedBy: customer.id }),
    (e) => e.statusCode === 400 && /completed/i.test(e.message),
  );
});

test('C-S1: invalid amounts are rejected (zero, negative, excessive, non-numeric)', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  for (const amount of [0, -5, 150, 'abc']) {
    await assert.rejects(
      createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount }),
      (e) => e.statusCode === 400,
    );
  }
  // A valid partial amount still creates the request.
  const refund = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 40 });
  assert.equal(Number(refund.amount), 40);
});

test('C-S1: a customer cannot request a refund for someone else’s payment', async () => {
  const other = await prisma.user.create({
    data: { name: `Other ${RND}`, email: `other.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  const payment = await mkPayment({ userId: other.id, captured: 100 });
  await assert.rejects(
    createRefundRequest({ paymentId: payment.id, requestedBy: customer.id }),
    (e) => e.statusCode === 403,
  );
});

test('C-S1: duplicate open refund returns the existing request instead of creating a second one', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const first = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 30 });
  const second = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 50 });
  assert.equal(second.alreadyOpen, true);
  assert.equal(second.refund.id, first.id);
  assert.equal(await prisma.refundRequest.count({ where: { paymentId: payment.id } }), 1);
});

test('C-S1: full lifecycle review -> approve -> process -> complete revokes the subscription once', async () => {
  const subscription = await mkSubscription(customer.id);
  const payment = await mkPayment({ userId: customer.id, captured: 100, subscriptionId: subscription.id });

  const created = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id });
  const reviewed = await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  assert.equal(reviewed.status, 'UNDER_REVIEW');
  const approved = await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' });
  assert.equal(approved.status, 'APPROVED');
  assert.ok(approved.decidedAt);

  const processing = await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-${RND}-1` });
  assert.equal(processing.status, 'PROCESSING');

  const completed = await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'complete' });
  assert.equal(completed.status, 'COMPLETED');
  assert.ok(completed.completedAt);

  const revoked = await prisma.userSubscription.findUnique({ where: { id: subscription.id } });
  assert.equal(revoked.status, 'refunded');
  assert.equal(revoked.autoRenew, false);

  // Payment itself keeps its gateway state (gateway refund path owns that field).
  const freshPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(freshPayment.status, 'COMPLETED');
});

test('C-S1: over-refund prevention — completed refunds reduce the refundable remainder', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const first = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 60 });
  await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' });
  await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-${RND}-2` });
  await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'complete' });

  // Remaining refundable is 40; requesting 50 must fail, 40 succeeds.
  await assert.rejects(
    createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 50 }),
    (e) => e.statusCode === 400 && /exceeds/i.test(e.message),
  );
  const second = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id });
  assert.equal(Number(second.amount), 40);
});

test('C-S1: concurrent creation cannot over-commit the captured amount', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const [a, b] = await Promise.allSettled([
    createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 100 }),
    createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 100 }),
  ]);
  const openCount = await prisma.refundRequest.count({ where: { paymentId: payment.id, status: { in: OPEN_REFUND_STATUSES } } });
  assert.equal(openCount, 1, 'exactly one open refund may exist');
  const created = [a, b].filter((r) => r.status === 'fulfilled' && r.value.status === 'REQUESTED');
  assert.equal(created.length, 1, 'exactly one creation wins');
});

test('C-S1: concurrent duplicate transitions have a single effect (race loser gets 409)', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const created = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id });
  const reviewed = await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  assert.equal(reviewed.status, 'UNDER_REVIEW');

  const [a, b] = await Promise.allSettled([
    transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' }),
    transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' }),
  ]);
  const losers = [a, b].filter((r) => r.status === 'rejected');
  for (const loser of losers) {
    assert.equal(statusCode(loser.reason), 409, 'race loser must get a conflict');
  }
  const fresh = await prisma.refundRequest.findUnique({ where: { id: created.id } });
  assert.equal(fresh.status, 'APPROVED');
  assert.equal(await prisma.refundRequest.count({ where: { id: created.id, status: 'APPROVED' } }), 1);
});

test('C-S1: invalid transitions are rejected and leave state untouched', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const created = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id });

  await assert.rejects(
    transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'complete' }),
    (e) => e.statusCode === 409,
  );
  await assert.rejects(
    transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' }),
    (e) => e.statusCode === 409,
  );
  await assert.rejects(
    transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'CUSTOMER', action: 'approve' }),
    (e) => e.statusCode === 403,
  );
  await assert.rejects(
    transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'unknown-action' }),
    (e) => e.statusCode === 400,
  );
  const fresh = await prisma.refundRequest.findUnique({ where: { id: created.id } });
  assert.equal(fresh.status, 'REQUESTED');
});

test('C-S1: PROCESSING requires a provider reference; completion requires one too', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const created = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id });
  await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' });

  await assert.rejects(
    transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process' }),
    (e) => e.statusCode === 400 && /provider reference/i.test(e.message),
  );
  const processing = await transitionRefund({ refundId: created.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-${RND}-3` });
  assert.equal(processing.providerRef, `PROV-${RND}-3`);
});

test('C-S1: duplicate provider references are rejected at the database level', async () => {
  const paymentA = await mkPayment({ userId: customer.id, captured: 100 });
  const paymentB = await mkPayment({ userId: customer.id, captured: 100 });
  const a = await createRefundRequest({ paymentId: paymentA.id, requestedBy: customer.id, amount: 50 });
  const b = await createRefundRequest({ paymentId: paymentB.id, requestedBy: customer.id, amount: 50 });

  await transitionRefund({ refundId: a.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  await transitionRefund({ refundId: a.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' });
  await transitionRefund({ refundId: a.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-DUP-${RND}` });

  await transitionRefund({ refundId: b.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  await transitionRefund({ refundId: b.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' });
  await assert.rejects(
    transitionRefund({ refundId: b.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-DUP-${RND}` }),
    (e) => e.statusCode === 409 && /already in use/i.test(e.message),
  );
  // The loser transaction must not have corrupted refund B's state.
  const freshB = await prisma.refundRequest.findUnique({ where: { id: b.id } });
  assert.equal(freshB.status, 'APPROVED');
  assert.equal(freshB.providerRef, null);
});

test('C-S1: FAILED processing re-opens eligibility; REJECTED and CANCELLED are terminal', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });

  // Failed processing: a new request is allowed afterwards.
  const first = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 25 });
  await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' });
  await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-FAIL-${RND}` });
  const failed = await transitionRefund({ refundId: first.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'fail', adminNote: 'Portal refund declined' });
  assert.equal(failed.status, 'FAILED');

  const retried = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 25 });
  assert.equal(retried.status, 'REQUESTED');

  // Rejected is terminal and requires an admin note (REJECTED is reached from UNDER_REVIEW).
  await transitionRefund({ refundId: retried.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
  await assert.rejects(
    transitionRefund({ refundId: retried.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'reject' }),
    (e) => e.statusCode === 400 && /admin note/i.test(e.message),
  );
  const rejected = await transitionRefund({ refundId: retried.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'reject', adminNote: 'Outside policy' });
  assert.equal(rejected.status, 'REJECTED');
  await assert.rejects(
    transitionRefund({ refundId: retried.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' }),
    (e) => e.statusCode === 409,
  );

  // Customer cancel works while open, and is terminal afterwards.
  const third = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 10 });
  const cancelled = await transitionRefund({ refundId: third.id, actorUserId: customer.id, actorRole: 'CUSTOMER', action: 'cancel' });
  assert.equal(cancelled.status, 'CANCELLED');
  await assert.rejects(
    transitionRefund({ refundId: third.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' }),
    (e) => e.statusCode === 409,
  );
  // Only the requester can cancel.
  const fourth = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 10 });
  await assert.rejects(
    transitionRefund({ refundId: fourth.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'cancel' }),
    (e) => e.statusCode === 403,
  );
});

test('C-S1: rejected/cancelled/failed refunds do not reserve amounts', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  for (const finalAction of ['fail', 'reject', 'cancel']) {
    const request = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 90 });
    if (finalAction === 'cancel') {
      await transitionRefund({ refundId: request.id, actorUserId: customer.id, actorRole: 'CUSTOMER', action: 'cancel' });
    } else if (finalAction === 'fail') {
      await transitionRefund({ refundId: request.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
      await transitionRefund({ refundId: request.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'approve' });
      await transitionRefund({ refundId: request.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-${finalAction}-${RND}-${request.id}` });
      await transitionRefund({ refundId: request.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'fail' });
    } else {
      // REJECTED is reached from UNDER_REVIEW.
      await transitionRefund({ refundId: request.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'review' });
      await transitionRefund({ refundId: request.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'reject', adminNote: 'No' });
    }
    // Full remaining amount is still available after each closed request.
    const next = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 100 });
    assert.equal(Number(next.amount), 100);
    await transitionRefund({ refundId: next.id, actorUserId: customer.id, actorRole: 'CUSTOMER', action: 'cancel' });
  }
});

test('C-S1: admin-initiated (goodwill) refunds are born APPROVED with decidedAt set', async () => {
  const payment = await mkPayment({ userId: customer.id, captured: 100 });
  const goodwill = await createRefundRequest({ paymentId: payment.id, requestedBy: customer.id, amount: 20, isAdmin: true });
  assert.equal(goodwill.status, 'APPROVED');
  assert.ok(goodwill.decidedAt);
  const processing = await transitionRefund({ refundId: goodwill.id, actorUserId: admin.id, actorRole: 'ADMIN', action: 'process', providerRef: `PROV-GW-${RND}` });
  assert.equal(processing.status, 'PROCESSING');
});
