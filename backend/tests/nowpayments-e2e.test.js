import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { prisma } from '../src/config/prisma.js';
import { sortObject } from '../src/services/paymentContracts.js';
import './assert-test-database.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5019;
const BASE = `http://127.0.0.1:${PORT}/api`;
const TEST_IPN_SECRET = 'luxora_nowpayments_test_secret_2026';
const MOCK_PORT = 5020;
const livePayments = new Map();

const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'payhere',
  NOWPAYMENTS_IPN_SECRET: TEST_IPN_SECRET,
  NOWPAYMENTS_API_KEY: 'test_nowpayments_api_key_sample',
  NOWPAYMENTS_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
  RESEND_API_KEY: '',
  NODE_ENV: 'test',
};

let server;
let mockNowPayments;

function computeIpnSig(payload, secret = TEST_IPN_SECRET) {
  const sorted = sortObject(payload);
  const jsonString = JSON.stringify(sorted);
  return crypto.createHmac('sha512', secret).update(jsonString).digest('hex');
}

before(async () => {
  try {
    await prisma.$executeRawUnsafe('ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS \'NOWPAYMENTS\';');
  } catch { /* ignore */ }

  mockNowPayments = createServer((req, res) => {
    const match = req.url?.match(/^\/v1\/payment\/(\d+)$/);
    const record = match && livePayments.get(match[1]);
    res.setHeader('Content-Type', 'application/json');
    if (!record) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
    res.end(JSON.stringify(record));
  });
  await new Promise((resolve) => mockNowPayments.listen(MOCK_PORT, '127.0.0.1', resolve));

  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

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
      spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      server.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (mockNowPayments) await new Promise((resolve) => mockNowPayments.close(resolve));
  await prisma.$disconnect();
});

test('NOWPayments E2E: GET /api/health confirms backend and DB is up', async () => {
  const response = await fetch(`${BASE}/health`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.db, 'up');
});

test('NOWPayments E2E: POST /api/payments/nowpayments/ipn rejects requests with missing or invalid signature', async () => {
  const payload = { order_id: 'LUX-NP-TEST-INVALID', payment_status: 'finished' };

  // 1. Missing signature
  const res1 = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(res1.status, 400);
  const data1 = await res1.json();
  assert.ok(data1.error.includes('Invalid IPN signature'));

  // 2. Wrong / tampered signature
  const res2 = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': 'bad_tampered_signature_hex_123',
    },
    body: JSON.stringify(payload),
  });
  assert.equal(res2.status, 400);
});

test('NOWPayments E2E: POST /api/payments/nowpayments/ipn rejects unlinked or missing order_id', async () => {
  const payload = { order_id: 'LUX-NP-NON-EXISTENT', payment_status: 'finished' };
  const sig = computeIpnSig(payload);

  const res = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': sig,
    },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error.includes('Payment record not found'));
});

test('NOWPayments E2E: Valid IPN settles payment, activates subscription, and is idempotent on duplicate delivery', async () => {
  const orderId = `LUX-NP-E2E-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let user = await prisma.user.findFirst({ where: { email: 'customer@luxora.lk' } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: `np_e2e_${Date.now()}@luxora.lk`, name: 'NP E2E User', role: 'CUSTOMER', passwordHash: '$2a$10$dummyhashfortestingnp1234567890abcdef' },
    });
  }

  let plan = await prisma.subscriptionPlan.findFirst();
  if (!plan) {
    plan = await prisma.subscriptionPlan.create({
      data: {
        title: 'Auto Care Basic',
        type: 'Auto Care',
        priceMonthly: 15000,
        features: '["Priority auto care"]',
        active: true,
      },
    });
  }

  // 1. Create a PENDING payment record with original LKR 15,000 and converted USD 45.65
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      planId: plan.id,
      gateway: 'NOWPAYMENTS',
      gatewayOrderId: orderId,
      idempotencyKey: orderId,
      expectedAmount: 15000,
      expectedCurrency: 'LKR',
      status: 'PENDING',
      webhookPayload: {
        conversion: {
          originalAmount: 15000,
          originalCurrency: 'LKR',
          convertedAmount: 45.65,
          convertedCurrency: 'USD',
          exchangeRate: 328.6,
        },
      },
    },
  });

  // 2. Deliver 'confirmed' IPN notification -> must remain PENDING
  const confirmedPayload = {
    actually_paid: 0.0005,
    order_description: 'Luxora Plan',
    order_id: orderId,
    pay_address: '0x1234567890abcdef',
    pay_amount: 0.0005,
    pay_currency: 'btc',
    payment_id: 99887766,
    payment_status: 'confirmed',
    price_amount: 45.65,
    price_currency: 'USD',
  };
  const confirmedSig = computeIpnSig(confirmedPayload);

  const resConfirmed = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': confirmedSig },
    body: JSON.stringify(confirmedPayload),
  });
  assert.equal(resConfirmed.status, 200);

  const stillPending = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(stillPending.status, 'PENDING', 'confirmed status must NOT mark payment COMPLETED');
  assert.equal(stillPending.subscriptionId, null, 'confirmed status must NOT create subscription');

  // 3. Deliver 'sending' IPN notification -> must remain PENDING
  const sendingPayload = {
    ...confirmedPayload,
    payment_status: 'sending',
  };
  const sendingSig = computeIpnSig(sendingPayload);

  const resSending = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': sendingSig },
    body: JSON.stringify(sendingPayload),
  });
  assert.equal(resSending.status, 200);

  const stillPendingSending = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(stillPendingSending.status, 'PENDING', 'sending status must NOT mark payment COMPLETED');
  assert.equal(stillPendingSending.subscriptionId, null, 'sending status must NOT create subscription');

  // 4. Deliver valid 'finished' IPN notification -> settles payment and activates subscription
  const ipnPayload = {
    actually_paid: 0.0005,
    order_description: 'Luxora Plan',
    order_id: orderId,
    pay_address: '0x1234567890abcdef',
    pay_amount: 0.0005,
    pay_currency: 'btc',
    payment_id: 99887766,
    payment_status: 'finished',
    price_amount: 45.65,
    price_currency: 'USD',
  };

  const sig = computeIpnSig(ipnPayload);
  const unverified = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': sig },
    body: JSON.stringify(ipnPayload),
  });
  assert.equal(unverified.status, 503, 'A finished IPN must not settle while the authoritative status query is unavailable');
  assert.equal((await prisma.payment.findUnique({ where: { id: payment.id } })).status, 'PENDING');

  livePayments.set(String(ipnPayload.payment_id), { ...ipnPayload });

  const res1 = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': sig,
    },
    body: JSON.stringify(ipnPayload),
  });

  assert.equal(res1.status, 200);
  const resData1 = await res1.json();
  assert.equal(resData1.status, 'ok');

  // Verify payment record in database transitioned to COMPLETED
  const updatedPayment = await prisma.payment.findUnique({
    where: { id: payment.id },
    include: { subscription: true },
  });
  assert.equal(updatedPayment.status, 'COMPLETED');
  assert.ok(updatedPayment.subscriptionId, 'Subscription was not created');
  assert.equal(updatedPayment.subscription.status, 'active');

  // 3. Duplicate IPN notification delivery (idempotency check)
  const res2 = await fetch(`${BASE}/payments/nowpayments/ipn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': sig,
    },
    body: JSON.stringify(ipnPayload),
  });

  assert.equal(res2.status, 200);
  const resData2 = await res2.json();
  assert.equal(resData2.status, 'ok');
  assert.equal(resData2.message, 'Payment already completed');

  // Clean up
  await prisma.userSubscription.deleteMany({ where: { id: updatedPayment.subscriptionId } });
  await prisma.payment.deleteMany({ where: { gatewayOrderId: orderId } });
});
