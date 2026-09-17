// Slice 10 — real-database tests for payout statements and the webhook viewer.
// Marker-scoped fixtures keep exact totals despite the shared luxora_test schema.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import './assert-test-database.js';
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import adminRouter from '../src/routes/admin.js';

const MARK = `wtl${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`;
const PAID_ROWS = 1001; // exceeds the export bound on purpose
let listener;
let base;
let admin;
let customer;
let providerAccount;
let bankAccount;
const created = { users: [], payouts: [], bulkPayouts: [], payments: [], refunds: [] };

const headers = (user) => user ? { Authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion }, JWT_SECRET)}` } : {};
async function get(user, route) {
  const response = await fetch(`${base}${route}`, { headers: headers(user), signal: AbortSignal.timeout(20000) });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('json') ? await response.json().catch(() => ({})) : await response.text();
  return { status: response.status, body, headers: response.headers };
}

before(async () => {
  admin = await prisma.user.create({ data: { name: `WT admin ${MARK}`, email: `wt-admin-${MARK}@test.luxora`, passwordHash: 'unused', role: 'ADMIN', emailVerified: true } });
  created.users.push(admin.id);
  customer = await prisma.user.create({ data: { name: `WT customer ${MARK}`, email: `wt-cust-${MARK}@test.luxora`, passwordHash: 'unused', role: 'CUSTOMER', emailVerified: true } });
  created.users.push(customer.id);
  providerAccount = await prisma.user.create({
    data: { name: `WT provider ${MARK}`, email: `wt-prov-${MARK}@test.luxora`, passwordHash: 'unused', role: 'PROVIDER', emailVerified: true, provider: { create: { category: 'Auto Care', serviceTowns: 'Colombo', kycStatus: 'APPROVED' } } },
    include: { provider: true },
  });
  created.users.push(providerAccount.id);
  bankAccount = await prisma.providerBankAccount.create({ data: { providerId: providerAccount.provider.id, bankName: 'Statement Bank', accountHolder: 'WT Holder', accountNumber: '0001234567890', branch: 'Colombo', selected: true } });

  // One MONTHLY payout per provider/period (schema-unique) plus REDEMPTION
  // rows with free-form redeem periods — mirrors the real payout shapes.
  // One payout carries a formula-injection attempt in untrusted text; the CSV
  // serializer must deliver it inert (statement JSON keeps the original value).
  const payout = (period, status, amount, key) => ({
    providerId: providerAccount.provider.id, bankAccountId: bankAccount.id, period, status, amount,
    idempotencyKey: `${key}-${MARK}`, bankNameSnapshot: 'Statement Bank',
    accountHolderSnapshot: key === 'k1' ? '=HYPERLINK("http://evil.test","click")' : 'WT Holder',
    accountNumberSnapshot: 'ACC-987654321', branchSnapshot: 'Colombo',
  });
  created.payouts.push(...(await prisma.providerPayout.createManyAndReturn({
    data: [
      payout('2026-08', 'PAID', 4500, 'monthly-aug'), payout('2026-07', 'PAID', 500, 'monthly-jul'),
      payout('2026-09', 'PENDING', 750, 'monthly-sep'), payout('2026-06', 'FAILED', 300, 'monthly-jun'),
      payout(`redeem-${MARK}-1`, 'PAID', 1000, 'k1'), payout(`redeem-${MARK}-2`, 'PAID', 1500, 'k2'),
      payout(`redeem-${MARK}-3`, 'PENDING', 250, 'k3'), payout(`redeem-${MARK}-4`, 'FAILED', 400, 'k4'),
    ], select: { id: true },
  })).map((row) => row.id));

  const payment = (gateway, status, orderId, payload, amount = 12000) => prisma.payment.create({
    data: { userId: customer.id, gateway, status, gatewayOrderId: orderId, idempotencyKey: orderId, expectedAmount: amount, expectedCurrency: 'LKR', capturedAmount: status === 'COMPLETED' ? amount : null, capturedCurrency: status === 'COMPLETED' ? 'LKR' : null, webhookPayload: payload },
  });
  created.payments.push((await payment('PAYHERE', 'COMPLETED', `WTP-1-${MARK}`, { merchant_id: 'M-1', order_id: `WTP-1-${MARK}`, payhere_amount: '12000.00', payhere_currency: 'LKR', status_code: 2, md5sig: 'TOPSECRETMD5VALUE' })).id);
  created.payments.push((await payment('PAYHERE', 'REFUNDED', `WTP-2-${MARK}`, { order_id: `WTP-2-${MARK}`, status_code: -3, md5sig: 'REFUNDSIGVALUE' })).id);
  created.payments.push((await payment('PAYHERE', 'PENDING', `WTP-3-${MARK}`, { supersededBy: `WTP-NEW-${MARK}`, supersededAt: new Date().toISOString() })).id);
  created.payments.push((await payment('NOWPAYMENTS', 'COMPLETED', `WTP-4-${MARK}`, { payment_status: 'finished', price_amount: 0.05, price_currency: 'usd', pay_address: 'bc1qxyznotreal', api_key: 'SECRETKEYVALUE', merchant_secret: 'SECRETSECRETVALUE', access_token: 'TOKENTOKENVALUE' }, 12500)).id);
  created.payments.push((await payment('NOWPAYMENTS', 'PENDING', `WTP-5-${MARK}`, { payment_status: 'waiting', giant: 'A'.repeat(300000) })).id);
  created.payments.push((await payment('DEMO', 'COMPLETED', `WTP-6-${MARK}`, { promotion: { id: 1, code: 'WTP', title: 'Promo', discountPct: 15, originalAmount: 1000, discountAmount: 150 } })).id);
  // A payment with no stored webhook payload must never appear in the viewer.
  created.payments.push((await prisma.payment.create({ data: { userId: customer.id, gateway: 'PAYHERE', status: 'PENDING', gatewayOrderId: `WTP-7-${MARK}`, idempotencyKey: `WTP-7-${MARK}`, expectedAmount: 1000, expectedCurrency: 'LKR' } })).id);
  const refundedPayment = await prisma.payment.findUnique({ where: { gatewayOrderId: `WTP-2-${MARK}` } });
  created.refunds.push((await prisma.refundRequest.create({ data: { paymentId: refundedPayment.id, requestedBy: customer.id, amount: 12000, currency: 'LKR', status: 'COMPLETED', providerRef: 'PROV-REF-ABC' } })).id);

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
    if (created.refunds.length) await prisma.refundRequest.deleteMany({ where: { id: { in: created.refunds } } });
    if (created.payments.length) await prisma.payment.deleteMany({ where: { id: { in: created.payments } } });
    if (created.bulkPayouts.length) await prisma.providerPayout.deleteMany({ where: { id: { in: created.bulkPayouts } } });
    if (created.payouts.length) await prisma.providerPayout.deleteMany({ where: { id: { in: created.payouts } } });
    if (bankAccount) await prisma.providerBankAccount.delete({ where: { id: bankAccount.id } }).catch(() => {});
    if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  } finally {
    await prisma.$disconnect();
  }
});

describe('payout statements', { concurrency: false }, () => {
  test('admin receives statement lines with exact period totals', async () => {
    const result = await get(admin, `/admin/payout-statements?provider_id=${providerAccount.provider.id}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 8);
    assert.equal(result.body.summary.itemCount, 8);
    assert.equal(result.body.summary.paidCount, 4);
    assert.equal(result.body.summary.paidTotal, 7500);
    assert.equal(result.body.summary.pendingTotal, 1000);
    assert.equal(result.body.summary.failedTotal, 700);
    assert.equal(result.body.summary.currency, 'LKR');
    const line = result.body.data.find((row) => row.reference === `k1-${MARK}`);
    assert.equal(line.amount, 1000);
    assert.equal(line.bank.account_masked.endsWith('4321'), true, 'account must be masked to last four');
    assert.ok(!JSON.stringify(result.body).includes('ACC-987654321'), 'full account number must never appear');
    assert.equal(line.provider.email, `wt-prov-${MARK}@test.luxora`);
  });

  test('status and period filters combine with pagination', async () => {
    const paid = await get(admin, `/admin/payout-statements?provider_id=${providerAccount.provider.id}&status=paid`);
    assert.equal(paid.body.pagination.total, 4);
    assert.ok(paid.body.data.every((row) => row.status === 'paid'));
    const august = await get(admin, `/admin/payout-statements?provider_id=${providerAccount.provider.id}&from=2026-08&to=2026-08`);
    assert.equal(august.body.pagination.total, 1);
    assert.equal(august.body.summary.paidTotal, 4500);
    const paged = await get(admin, `/admin/payout-statements?provider_id=${providerAccount.provider.id}&pageSize=3&page=2`);
    assert.equal(paged.body.data.length, 3);
    assert.equal(paged.body.pagination.page, 2);
    assert.equal(paged.body.pagination.hasPrevious, true);
  });

  test('period validation rejects bad formats, inverted ranges, and oversized windows', async () => {
    assert.equal((await get(admin, '/admin/payout-statements?from=2026-1')).status, 400);
    assert.equal((await get(admin, '/admin/payout-statements?from=2026-13')).status, 400);
    assert.equal((await get(admin, '/admin/payout-statements?from=2026-08&to=2026-07')).status, 400);
    assert.equal((await get(admin, '/admin/payout-statements?from=2024-01&to=2026-09')).status, 400);
    const badStatus = await get(admin, '/admin/payout-statements?status=completed');
    assert.equal(badStatus.status, 400);
  });

  test('empty period returns an empty bounded page with zero totals', async () => {
    const result = await get(admin, `/admin/payout-statements?provider_id=${providerAccount.provider.id}&from=2030-01&to=2030-01`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, []);
    assert.equal(result.body.pagination.total, 0);
    assert.equal(result.body.summary.itemCount, 0);
    assert.equal(result.body.summary.paidTotal, 0);
  });

  test('CSV export matches the JSON statement data exactly', async () => {
    const query = `provider_id=${providerAccount.provider.id}&status=paid`;
    const csv = await get(admin, `/admin/payout-statements/export?${query}`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    const rows = csv.body.trim().split('\r\n');
    assert.equal(rows.length, 5, 'header plus four paid lines');
    assert.match(rows[0], /Payout ID,Period,Kind,Status,Amount/);
    const json = await get(admin, `/admin/payout-statements?${query}`);
    const csvIds = rows.slice(1).map((row) => Number(row.split(',')[0])).sort((a, b) => a - b);
    const jsonIds = json.body.data.map((row) => row.id).sort((a, b) => a - b);
    assert.deepEqual(csvIds, jsonIds, 'export and API must render the same statement');
    const amounts = rows.slice(1).map((row) => row.split(',')[4]).sort();
    assert.deepEqual(amounts, ['1000.00', '1500.00', '4500.00', '500.00']);
    assert.ok(!csv.body.includes('ACC-987654321'));
    assert.ok(!csv.body.includes(',=HYPERLINK') && !csv.body.includes(',"=HYPERLINK'), 'formula text must never begin a CSV cell');
    assert.ok(csv.body.includes(`"'=HYPERLINK`), 'formula text must be delivered apostrophe-neutralized');
  });

  test('oversized exports fail safely instead of streaming unbounded rows', async () => {
    created.bulkPayouts.push(...(await prisma.providerPayout.createManyAndReturn({
      data: Array.from({ length: PAID_ROWS }, (_, index) => ({
        providerId: providerAccount.provider.id, bankAccountId: bankAccount.id, period: `redeem-bulk-${MARK}-${index}`, kind: 'REDEMPTION',
        status: 'PAID', amount: 1, idempotencyKey: `bulk-${MARK}-${index}`,
      })), select: { id: true },
    })).map((row) => row.id));
    const blocked = await get(admin, `/admin/payout-statements/export?provider_id=${providerAccount.provider.id}`);
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.error, /narrow the period range/i);
    const narrowed = await get(admin, `/admin/payout-statements/export?provider_id=${providerAccount.provider.id}&from=2026-07&to=2026-08`);
    assert.equal(narrowed.status, 200);
    assert.equal(narrowed.body.trim().split('\r\n').length, 3, 'two monthly paid rows in the window plus header');
  });

  test('statement endpoints are admin-only', async () => {
    for (const route of ['/admin/payout-statements', '/admin/payout-statements/export']) {
      assert.equal((await get(customer, route)).status, 403, `customer denied on ${route}`);
      assert.equal((await get(providerAccount, route)).status, 403, `provider denied on ${route}`);
      assert.equal((await get(null, route)).status, 401, `anonymous denied on ${route}`);
    }
  });
});

describe('webhook event viewer', { concurrency: false }, () => {
  test('lists only payments with stored payloads, newest first with deterministic ties', async () => {
    const result = await get(admin, `/admin/webhook-events?reference=${MARK}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 6, 'payment without payload must be excluded');
    assert.ok(result.body.data.length <= 25);
    const tuples = result.body.data.map((row) => [new Date(row.received_at).getTime(), row.payment_id]);
    for (let index = 1; index < tuples.length; index += 1) {
      const [prevTime, prevId] = tuples[index - 1];
      const [time, id] = tuples[index];
      assert.ok(prevTime > time || (prevTime === time && prevId > id), 'ordering must be updatedAt desc, id desc');
    }
  });

  test('gateway, status, payment, and reference filters narrow the viewer', async () => {
    const payhere = await get(admin, `/admin/webhook-events?reference=${MARK}&gateway=payhere`);
    assert.equal(payhere.body.pagination.total, 3);
    assert.ok(payhere.body.data.every((row) => row.gateway === 'payhere'));
    const refunded = await get(admin, `/admin/webhook-events?reference=${MARK}&status=refunded`);
    assert.equal(refunded.body.pagination.total, 1);
    assert.equal(refunded.body.data[0].payment_status, 'refunded');
    const badGateway = await get(admin, '/admin/webhook-events?gateway=stripe');
    assert.equal(badGateway.status, 400);
    const byId = await get(admin, `/admin/webhook-events?payment_id=${created.payments[0]}`);
    assert.equal(byId.body.pagination.total, 1);
    assert.equal(byId.body.data[0].event_kind, 'charge_settled');
  });

  test('date filters validate format, order, and span', async () => {
    assert.equal((await get(admin, '/admin/webhook-events?from=2026/01/01')).status, 400);
    assert.equal((await get(admin, '/admin/webhook-events?from=2026-09-10&to=2026-09-01')).status, 400);
    assert.equal((await get(admin, '/admin/webhook-events?from=2026-01-01&to=2026-09-18')).status, 400);
    const today = new Date().toISOString().slice(0, 10);
    const windowed = await get(admin, `/admin/webhook-events?reference=${MARK}&from=${today}&to=${today}`);
    assert.equal(windowed.status, 200);
    assert.equal(windowed.body.pagination.total, 6, 'same-day fixtures all fall inside the window');
  });

  test('payloads are redacted and oversized payloads never reach the browser', async () => {
    const list = await get(admin, `/admin/webhook-events?reference=${MARK}`);
    const text = JSON.stringify(list.body);
    assert.ok(!text.includes('TOPSECRETMD5VALUE'), 'list must not embed raw payloads');
    const detail = await get(admin, `/admin/webhook-events/${created.payments[3]}`);
    assert.equal(detail.status, 200);
    const detailText = JSON.stringify(detail.body);
    for (const secret of ['SECRETKEYVALUE', 'SECRETSECRETVALUE', 'TOKENTOKENVALUE']) {
      assert.ok(!detailText.includes(secret), `sensitive value ${secret} must be redacted`);
    }
    assert.equal(detail.body.payload.api_key, '[REDACTED]');
    assert.equal(detail.body.payload.merchant_secret, '[REDACTED]');
    assert.equal(detail.body.payload.access_token, '[REDACTED]');
    assert.equal(detail.body.payload.payment_status, 'finished', 'non-sensitive fields stay inspectable');
    assert.equal(detail.body.payload.pay_address, 'bc1qxyznotreal', 'public blockchain data stays inspectable');
    assert.equal(detail.body.event_kind, 'charge_settled');
  });

  test('large payloads report size and truncate instead of exploding the response', async () => {
    const detail = await get(admin, `/admin/webhook-events/${created.payments[4]}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.payload_truncated, true, 'oversized strings must be flagged');
    assert.equal(detail.body.payload.payment_status, 'waiting');
    assert.ok(detail.body.payload.giant.length <= 1100, 'oversized values must be cut down');
    assert.match(detail.body.payload.giant, /truncated 29\d{4} chars/);
    assert.ok(detail.body.payload_bytes > 300000);
    assert.ok(JSON.stringify(detail.body).length < 10000, 'detail response must stay small');
  });

  test('classification covers refunds, supersession, and demo events', async () => {
    const kinds = {};
    const list = await get(admin, `/admin/webhook-events?reference=${MARK}&pageSize=100`);
    for (const row of list.body.data) kinds[row.event_kind] = (kinds[row.event_kind] || 0) + 1;
    assert.equal(kinds.charge_settled, 2);
    assert.equal(kinds.refund_event, 1);
    assert.equal(kinds.order_superseded, 1);
    assert.equal(kinds.demo_purchase, 1);
    assert.equal(kinds.ipn_waiting, 1);
  });

  test('detail exposes refund correlation and 404s cleanly', async () => {
    const detail = await get(admin, `/admin/webhook-events/${created.payments[1]}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.refund_correlation, { refund_id: created.refunds[0], status: 'completed', provider_ref: 'PROV-REF-ABC', amount: 12000 });
    assert.equal((await get(admin, `/admin/webhook-events/${created.payments[6]}`)).status, 404, 'payment without payload is not a viewer event');
    assert.equal((await get(admin, '/admin/webhook-events/999999')).status, 404);
    assert.equal((await get(admin, '/admin/webhook-events/abc')).status, 400);
  });

  test('viewer is read-only and admin-only', async () => {
    for (const route of ['/admin/webhook-events', `/admin/webhook-events/${created.payments[0]}`]) {
      assert.equal((await get(customer, route)).status, 403, `customer denied on ${route}`);
      assert.equal((await get(providerAccount, route)).status, 403, `provider denied on ${route}`);
      assert.equal((await get(null, route)).status, 401, `anonymous denied on ${route}`);
    }
    const mutation = await fetch(`${base}/admin/webhook-events/${created.payments[0]}`, { method: 'PUT', headers: { ...headers(admin), 'Content-Type': 'application/json' }, body: JSON.stringify({ replay: true }) });
    assert.equal(mutation.status, 404, 'no mutation route may exist');
    const replay = await fetch(`${base}/admin/webhook-events/${created.payments[0]}/replay`, { method: 'POST', headers: headers(admin) });
    assert.equal(replay.status, 404, 'no replay route may exist');
  });
});
