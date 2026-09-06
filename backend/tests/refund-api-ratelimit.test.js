// V2 Slice 2 — rate-limit behavior of the customer refund API on a dedicated
// server instance (fresh limiter state): 30 requests per 15 minutes per IP.
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

const PORT = 5045;
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
let customer;
let payment;
const token = () => jwt.sign({ id: customer.id, role: customer.role, tokenVersion: 0 }, JWT_SECRET);

const json = async (apiPath, options = {}) => {
  const response = await fetch(`${BASE}${apiPath}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token()}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
};

before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: 'ignore' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (attempt === 59) throw new Error('Test server failed to start');
  }
  customer = await prisma.user.create({
    data: { name: `RefLimit Customer ${RND}`, email: `reflimit.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'CUSTOMER', active: true },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: { title: `RefLimit Plan ${RND}`, type: 'Auto Care', priceMonthly: 9000, durationDays: 30, features: '[]' },
  });
  payment = await prisma.payment.create({
    data: {
      userId: customer.id,
      planId: plan.id,
      gateway: 'PAYHERE',
      gatewayOrderId: `LUX-RL-${RND}-1`,
      idempotencyKey: `LUX-RL-${RND}-1`,
      expectedAmount: 100,
      expectedCurrency: 'LKR',
      capturedAmount: 100,
      capturedCurrency: 'LKR',
      status: 'COMPLETED',
    },
  });
});

after(async () => {
  await stopChildProcess(server);
  await prisma.$disconnect();
});

test('C-S2 rate limit: the 31st refund request from one IP is rejected with 429; data is unchanged', async () => {
  let saw429 = false;
  let last = null;
  for (let i = 1; i <= 31; i += 1) {
    last = await json('/payments/refunds', {
      method: 'POST',
      body: JSON.stringify({ payment_id: payment.id, reason: `Rate limit probe ${i}` }),
    });
    if (last.status === 429) { saw429 = true; break; }
    // Retries of the same payment are absorbed idempotently (200 after the first).
    assert.ok([200, 201].includes(last.status), `request #${i} returned ${last.status}`);
  }
  assert.equal(saw429, true, 'expected a 429 once the per-IP allowance is exhausted');
  assert.equal(last.status, 429);
  assert.match(last.body.error, /Too many refund requests/i);

  // The limiter must not have created extra refunds or changed the payment.
  assert.equal(await prisma.refundRequest.count({ where: { paymentId: payment.id } }), 1);
  const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert.equal(fresh.status, 'COMPLETED');
});
