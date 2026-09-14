// Slice 9 — real-database pagination contract tests for admin collections.
// Marker-scoped fixtures keep every assertion exact even though the shared
// luxora_test schema accumulates rows from other suites in the same run.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import './assert-test-database.js';
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import adminRouter from '../src/routes/admin.js';

const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const MARK = `pgt${suffix}`;
let listener;
let base;
let admin;
let customer;
let providerUser;
let category;
let service;
const created = { users: [], bookings: [], complaints: [], refunds: [], payments: [], reviews: [], audits: [] };

const headers = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion }, JWT_SECRET)}`, 'Content-Type': 'application/json' });
async function get(user, route) {
  const response = await fetch(`${base}${route}`, { headers: headers(user), signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

before(async () => {
  category = await prisma.category.create({ data: { name: `PG category ${MARK}` } });
  service = await prisma.service.create({ data: { categoryId: category.id, title: `PG service ${MARK}`, price: 100, providerEarning: 50 } });
  admin = await prisma.user.create({ data: { name: `PG admin ${MARK}`, email: `pg-admin-${MARK}@test.luxora`, passwordHash: 'unused', role: 'ADMIN', emailVerified: true } });
  created.users.push(admin.id);
  customer = await prisma.user.create({ data: { name: `PG customer ${MARK}`, email: `pg-cust-${MARK}@test.luxora`, passwordHash: 'unused', role: 'CUSTOMER', emailVerified: true } });
  created.users.push(customer.id);
  const providerAccount = await prisma.user.create({ data: { name: `PG provider ${MARK}`, email: `pg-prov-${MARK}@test.luxora`, passwordHash: 'unused', role: 'PROVIDER', emailVerified: true, provider: { create: { category: category.name, serviceTowns: 'Colombo', kycStatus: 'APPROVED' } } }, include: { provider: true } });
  created.users.push(providerAccount.id);
  providerUser = providerAccount;

  // 30 marker bookings: bounded-page and search assertions stay exact.
  const bookingRows = Array.from({ length: 30 }, (_, index) => ({
    userId: customer.id, serviceId: service.id, bookingDate: '2099-01-01', bookingTime: '09:00',
    town: 'Colombo', status: index % 2 ? 'COMPLETED' : 'PENDING', totalPrice: 100, providerEarning: 50,
  }));
  created.bookings.push(...(await prisma.booking.createManyAndReturn({ data: bookingRows, select: { id: true } })).map((row) => row.id));

  // Six same-instant users prove the deterministic id tiebreaker across pages.
  const sameInstant = new Date('2026-01-01T00:00:00.000Z');
  created.users.push(...(await prisma.user.createManyAndReturn({
    data: Array.from({ length: 6 }, (_, index) => ({ name: `${MARK} PageOrder ${index}`, email: `pg-order-${MARK}-${index}@test.luxora`, passwordHash: 'unused', role: 'CUSTOMER', emailVerified: true, createdAt: sameInstant })),
    select: { id: true },
  })).map((row) => row.id));

  // Four complaints: two OPEN, two RESOLVED.
  created.complaints.push(...(await prisma.complaint.createManyAndReturn({
    data: [
      { userId: customer.id, subject: `${MARK} open 1`, description: 'x', status: 'OPEN' },
      { userId: customer.id, subject: `${MARK} open 2`, description: 'x', status: 'OPEN' },
      { userId: customer.id, subject: `${MARK} done 1`, description: 'x', status: 'RESOLVED' },
      { userId: customer.id, subject: `${MARK} done 2`, description: 'x', status: 'RESOLVED' },
    ], select: { id: true },
  })).map((row) => row.id));

  const payment = await prisma.payment.create({ data: { userId: customer.id, gateway: 'DEMO', gatewayOrderId: `PG-${MARK}`, idempotencyKey: `PG-${MARK}`, expectedAmount: 1000, expectedCurrency: 'LKR', status: 'COMPLETED', capturedAmount: 1000, capturedCurrency: 'LKR' } });
  created.payments.push(payment.id);
  for (const [index, status] of ['REQUESTED', 'COMPLETED', 'REJECTED'].entries()) {
    const refund = await prisma.refundRequest.create({ data: { paymentId: payment.id, requestedBy: customer.id, amount: 100, currency: 'LKR', status, requestedAt: new Date(Date.now() - (3 - index) * 60000) } });
    created.refunds.push(refund.id);
  }

  for (const index of [0, 1]) {
    const booking = await prisma.booking.create({ data: { userId: customer.id, providerId: providerAccount.provider.id, serviceId: service.id, bookingDate: '2099-02-01', bookingTime: '10:00', town: 'Colombo', status: 'COMPLETED', totalPrice: 100, providerEarning: 50 } });
    created.bookings.push(booking.id);
    const review = await prisma.review.create({ data: { bookingId: booking.id, userId: customer.id, providerId: providerAccount.provider.id, rating: 5, comment: `${MARK} review ${index}` } });
    created.reviews.push(review.id);
  }

  created.audits.push(...(await prisma.adminAuditLog.createManyAndReturn({
    data: Array.from({ length: 5 }, (_, index) => ({ adminId: admin.id, action: `${MARK}_ACTION_${index}`, targetType: 'Test', createdAt: new Date(Date.now() - (6 - index) * 60000) })),
    select: { id: true },
  })).map((row) => row.id));

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  listener = await new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  base = `http://127.0.0.1:${listener.address().port}/api`;
});

after(async () => {
  if (listener) await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  try {
    if (created.reviews.length) await prisma.review.deleteMany({ where: { id: { in: created.reviews } } });
    if (created.complaints.length) await prisma.complaint.deleteMany({ where: { id: { in: created.complaints } } });
    if (created.refunds.length) await prisma.refundRequest.deleteMany({ where: { id: { in: created.refunds } } });
    if (created.payments.length) await prisma.payment.deleteMany({ where: { id: { in: created.payments } } });
    if (created.bookings.length) await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } });
    if (created.audits.length) await prisma.adminAuditLog.deleteMany({ where: { id: { in: created.audits } } });
    if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    if (service) await prisma.service.delete({ where: { id: service.id } });
    if (category) await prisma.category.delete({ where: { id: category.id } });
  } finally {
    await prisma.$disconnect();
  }
});

describe('admin collection pagination', { concurrency: false }, () => {
  test('users paginate by default with full metadata', async () => {
    const result = await get(admin, `/admin/users?search=${MARK}`);
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.body.data));
    assert.ok(result.body.data.length <= 25);
    assert.deepEqual(
      { page: result.body.pagination.page, pageSize: result.body.pagination.pageSize, hasNext: result.body.pagination.hasNext, hasPrevious: result.body.pagination.hasPrevious },
      { page: 1, pageSize: 25, hasNext: false, hasPrevious: false },
    );
    assert.ok(result.body.pagination.total >= 8, 'marker users plus staff must be counted');
    assert.equal(result.body.pagination.totalPages, Math.ceil(result.body.pagination.total / 25));
  });

  test('explicit page and pageSize navigate the filtered set', async () => {
    const first = await get(admin, `/admin/users?search=${MARK} PageOrder&pageSize=2&page=1`);
    const second = await get(admin, `/admin/users?search=${MARK} PageOrder&pageSize=2&page=2`);
    const third = await get(admin, `/admin/users?search=${MARK} PageOrder&pageSize=2&page=3`);
    assert.equal(first.body.pagination.total, 6);
    assert.deepEqual(first.body.data.map((row) => row.name.split(' ').pop()), ['5', '4']);
    assert.deepEqual(second.body.data.map((row) => row.name.split(' ').pop()), ['3', '2']);
    assert.deepEqual(third.body.data.map((row) => row.name.split(' ').pop()), ['1', '0']);
    assert.equal(first.body.pagination.hasNext, true);
    assert.equal(third.body.pagination.hasNext, false);
    assert.equal(third.body.pagination.hasPrevious, true);
  });

  test('ordering is deterministic when timestamps tie', async () => {
    const ids = [];
    for (const page of [1, 2, 3]) {
      const result = await get(admin, `/admin/users?search=${MARK} PageOrder&pageSize=2&page=${page}`);
      ids.push(...result.body.data.map((row) => row.id));
    }
    assert.equal(new Set(ids).size, 6, 'pages must not overlap');
    assert.deepEqual(ids, [...ids].sort((a, b) => b - a), 'equal createdAt must fall back to id desc');
  });

  test('users search and role filter combine with pagination', async () => {
    const result = await get(admin, `/admin/users?search=${MARK} PageOrder&role=provider`);
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 0);
    assert.deepEqual(result.body.data, []);
    const roles = await get(admin, `/admin/users?search=${MARK}&role=customer&pageSize=100`);
    assert.ok(roles.body.data.every((row) => row.role === 'CUSTOMER'));
    assert.ok(roles.body.pagination.total >= 7);
  });

  test('bookings are bounded to the default page size', async () => {
    const result = await get(admin, `/admin/bookings?search=${MARK}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.length, 25, 'default pageSize must cap bookings');
    assert.equal(result.body.pagination.total, 32);
    assert.equal(result.body.pagination.totalPages, 2);
    assert.equal(result.body.pagination.hasNext, true);
  });

  test('bookings status filter and search combine with pagination', async () => {
    const completed = await get(admin, `/admin/bookings?search=${MARK}&status=completed`);
    assert.equal(completed.body.pagination.total, 17);
    assert.ok(completed.body.data.every((row) => row.status === 'completed'));
    const byId = await get(admin, `/admin/bookings?search=%23${created.bookings[0]}`);
    assert.equal(byId.body.pagination.total, 1);
    assert.equal(byId.body.data[0].id, created.bookings[0]);
    const named = await get(admin, `/admin/bookings?search=PG customer ${MARK}&pageSize=100`);
    assert.equal(named.body.pagination.total, 32);
  });

  test('complaints status filter paginates exactly', async () => {
    const all = await get(admin, `/admin/complaints?search=${MARK}`);
    assert.equal(all.body.pagination.total, 4);
    const resolved = await get(admin, `/admin/complaints?search=${MARK}&status=resolved`);
    assert.equal(resolved.body.pagination.total, 2);
    assert.ok(resolved.body.data.every((row) => row.status === 'resolved'));
  });

  test('refunds pagination preserves status and customer filters', async () => {
    const all = await get(admin, `/admin/refunds?customer=${MARK}`);
    assert.equal(all.body.pagination.total, 3);
    const requested = await get(admin, `/admin/refunds?customer=${MARK}&status=requested`);
    assert.equal(requested.body.pagination.total, 1);
    assert.equal(requested.body.data[0].status, 'requested');
    const byId = await get(admin, `/admin/refunds?customer=%23${created.refunds[0]}`);
    assert.equal(byId.body.pagination.total, 1);
    assert.equal(byId.body.data[0].id, created.refunds[0]);
  });

  test('reviews pagination is additive to summary and providers', async () => {
    const result = await get(admin, `/admin/reviews?search=${MARK}&pageSize=1&page=2`);
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 2);
    assert.equal(result.body.reviews.length, 1);
    assert.equal(result.body.pagination.page, 2);
    assert.ok(result.body.summary.review_count >= 2, 'global summary must stay unpaginated');
    assert.ok(result.body.providers.length >= 1);
  });

  test('audit logs page through bounded history with consistent metadata', async () => {
    const first = await get(admin, '/admin/audit-logs?pageSize=2');
    const second = await get(admin, '/admin/audit-logs?pageSize=2&page=2');
    assert.equal(first.status, 200);
    assert.equal(first.body.data.length, 2);
    assert.equal(second.body.data.length, 2);
    const firstIds = first.body.data.map((row) => row.id);
    const secondIds = second.body.data.map((row) => row.id);
    assert.equal(new Set([...firstIds, ...secondIds]).size, 4, 'pages must not overlap');
    assert.ok(first.body.pagination.total >= 5);
    assert.equal(first.body.pagination.totalPages, Math.ceil(first.body.pagination.total / 2));
    const last = await get(admin, `/admin/audit-logs?pageSize=2&page=${first.body.pagination.totalPages}`);
    assert.equal(last.body.pagination.hasNext, false);
    assert.ok(last.body.data.length >= 1);
  });

  test('oversized, invalid, and coerced pagination params are rejected', async () => {
    for (const query of ['page=0', 'page=-1', 'page=abc', 'page=true', 'page=1.5', 'page=1e2', 'pageSize=0', 'pageSize=-5', 'pageSize=abc', 'pageSize=true', 'pageSize=100.5', 'pageSize=101', 'pageSize=1000000', 'pageSize=1&pageSize=2', 'page=1&page=2']) {
      const result = await get(admin, `/admin/users?${query}`);
      assert.equal(result.status, 400, `expected 400 for ?${query}`);
      assert.match(result.body.error, /page and pageSize/);
    }
    const oversizedAudit = await get(admin, '/admin/audit-logs?pageSize=201');
    assert.equal(oversizedAudit.status, 400);
  });

  test('empty pages beyond the last return empty data with valid metadata', async () => {
    const result = await get(admin, `/admin/users?search=${MARK} PageOrder&pageSize=2&page=4`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, []);
    assert.equal(result.body.pagination.total, 6);
    assert.equal(result.body.pagination.page, 4);
    assert.equal(result.body.pagination.hasNext, false);
    assert.equal(result.body.pagination.hasPrevious, true);
  });

  test('deleted records keep responses bounded and totals fresh', async () => {
    const before = await get(admin, `/admin/bookings?search=${MARK}`);
    assert.equal(before.body.pagination.total, 32);
    await prisma.booking.delete({ where: { id: created.bookings[0] } });
    created.bookings = created.bookings.filter((id) => id !== created.bookings[0]);
    const after = await get(admin, `/admin/bookings?search=${MARK}`);
    assert.equal(after.body.pagination.total, 31);
    assert.equal(after.body.data.length, 25);
  });

  test('updated records are reflected inside filtered pages', async () => {
    const complaint = await prisma.complaint.findFirst({ where: { subject: { startsWith: MARK } }, orderBy: { id: 'asc' } });
    await prisma.complaint.update({ where: { id: complaint.id }, data: { status: 'IN_REVIEW' } });
    const review = await get(admin, `/admin/complaints?search=${MARK}&status=in_review`);
    assert.equal(review.body.pagination.total, 1);
    assert.equal(review.body.data[0].id, complaint.id);
  });

  test('paginated collections stay admin-only across roles', async () => {
    for (const route of ['/admin/users', '/admin/bookings?search=x', '/admin/complaints', '/admin/refunds', '/admin/reviews', '/admin/audit-logs']) {
      assert.equal((await get(customer, route)).status, 403, `customer must not read ${route}`);
      assert.equal((await get(providerUser, route)).status, 403, `provider must not read ${route}`);
    }
    const anonymous = await fetch(`${base}/admin/users`);
    assert.equal(anonymous.status, 401);
  });
});
