// Demo Payment gateway — independent checkout acceptance tests.
// Boots the real API against the isolated test database and exercises the
// criteria from the Demo Payment specification that are testable over HTTP:
// transactional completion, token granting, idempotency, payment-history
// identity, and gateway isolation.
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

const PORT = 5019;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RND = crypto.randomUUID().slice(0, 8);
// Empty gateway credentials prove Demo Payment works without any external
// payment provider or credentials. RESEND is emptied to avoid external email.
const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: '',
  RESEND_API_KEY: '',
  GOOGLE_CLIENT_ID: '',
  PAYHERE_MERCHANT_ID: '',
  PAYHERE_MERCHANT_SECRET: '',
  NOWPAYMENTS_API_KEY: '',
  NOWPAYMENTS_IPN_SECRET: '',
};

let server;
const json = async (path, options = {}) => {
  const response = await fetch(`${BASE}${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};
const authJson = (token, path, options = {}) => json(path, {
  ...options,
  headers: { ...options.headers, Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
});

const makeCustomer = async (label) => {
  const user = await prisma.user.create({
    data: { email: `demo_gw_${label}_${Date.now()}_${RND}@example.com`, passwordHash: 'fakehash', role: 'CUSTOMER', name: `Demo GW ${label}` },
  });
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-runs-1234567890';
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion }, jwtSecret, { expiresIn: '1h' });
  return { user, token };
};

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
  await stopChildProcess(server);
  await prisma.$disconnect();
});

test('Demo checkout completes a payment, activates the plan, and grants tokens', async () => {
  const { user, token } = await makeCustomer('happy');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true }, include: { entitlements: true } });
  assert.ok(plan, 'Plan must exist');
  const expectedCoins = plan.entitlements.reduce((sum, e) => sum + e.units, 0);

  const checkout = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: plan.id, billing_option: 'one_time', idempotency_key: `demo_happy_${Date.now()}_${RND}` }),
  });
  assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
  assert.equal(checkout.body.status, 'completed');
  assert.equal(checkout.body.payment.gateway, 'DEMO');
  assert.equal(checkout.body.receipt.provider, 'Demo Payment');
  assert.equal(checkout.body.receipt.coins_granted, expectedCoins);
  assert.ok(checkout.body.subscription.id);

  const subscription = await prisma.userSubscription.findUnique({ where: { id: checkout.body.subscription.id }, include: { entitlements: true, payments: true } });
  assert.equal(subscription.status, 'active');
  assert.equal(subscription.autoRenew, false, 'one_time billing must not enable auto-renewal');
  assert.equal(subscription.entitlements.reduce((sum, e) => sum + e.units, 0), expectedCoins);
  assert.ok(subscription.payments.some((pay) => pay.gateway === 'DEMO' && pay.status === 'COMPLETED'), 'payment must be DEMO + COMPLETED');

  // Payment history identifies the provider as Demo Payment with no charge
  const history = await authJson(token, '/payments/my');
  const row = history.body.payments.find((pay) => pay.id === checkout.body.payment.id);
  assert.equal(row.gateway, 'DEMO');
  assert.equal(row.status, 'COMPLETED');

  // Granted tokens survive re-reading (refresh / new login equivalent)
  const entAgain = await authJson(token, '/subscriptions/entitlements');
  const granted = entAgain.body.entitlements.reduce((sum, e) => sum + e.entitled_units, 0);
  assert.equal(granted, expectedCoins);
});

test('Demo checkout respects the auto-renew billing option', async () => {
  const { token } = await makeCustomer('renew');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });

  const checkout = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: plan.id, billing_option: 'auto_renew', idempotency_key: `demo_renew_${Date.now()}_${RND}` }),
  });
  assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
  const subscription = await prisma.userSubscription.findUnique({ where: { id: checkout.body.subscription.id } });
  assert.equal(subscription.autoRenew, true);
  assert.ok(subscription.nextRenewalDate, 'auto-renew subscription must carry a renewal date');
});

test('Repeated requests with the same idempotency reference never grant twice', async () => {
  const { user, token } = await makeCustomer('idem');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });
  const idempotencyKey = `demo_idem_${Date.now()}_${RND}`;

  const first = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: plan.id, billing_option: 'one_time', idempotency_key: idempotencyKey }),
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.duplicate, false);

  const repeat = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: plan.id, billing_option: 'one_time', idempotency_key: idempotencyKey }),
  });
  assert.ok([200, 201].includes(repeat.status));
  assert.equal(repeat.body.duplicate, true, 'the replay must be flagged as a duplicate');

  const payments = await prisma.payment.findMany({ where: { idempotencyKey } });
  assert.equal(payments.length, 1, 'no duplicate payment rows');
  const subscriptions = await prisma.userSubscription.findMany({ where: { userId: user.id, planId: plan.id } });
  assert.equal(subscriptions.length, 1, 'no duplicate subscriptions');
});

test('Concurrent checkouts sharing one reference grant tokens exactly once', async () => {
  const { user, token } = await makeCustomer('race');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });
  const idempotencyKey = `demo_race_${Date.now()}_${RND}`;

  const results = await Promise.all(Array.from({ length: 5 }, () =>
    authJson(token, '/payments/demo/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan_id: plan.id, billing_option: 'one_time', idempotency_key: idempotencyKey }),
    })
  ));
  assert.ok(results.every((r) => [200, 201].includes(r.status)), JSON.stringify(results.map((r) => r.status)));

  const payments = await prisma.payment.findMany({ where: { idempotencyKey, status: 'COMPLETED' } });
  assert.equal(payments.length, 1);
  const subscriptions = await prisma.userSubscription.findMany({ where: { userId: user.id, planId: plan.id } });
  assert.equal(subscriptions.length, 1);
});

test('Invalid billing options and unknown plans fail without partial benefits', async () => {
  const { user, token } = await makeCustomer('invalid');
  const beforePayments = await prisma.payment.count({ where: { userId: user.id } });
  const beforeSubs = await prisma.userSubscription.count({ where: { userId: user.id } });

  const badBilling = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: 1, billing_option: 'monthly', idempotency_key: `demo_bad_billing_${Date.now()}_${RND}` }),
  });
  assert.equal(badBilling.status, 400);

  const badKey = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: 1, billing_option: 'one_time', idempotency_key: 'short' }),
  });
  assert.equal(badKey.status, 400);

  const badPlan = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: 999999, billing_option: 'one_time', idempotency_key: `demo_bad_plan_${Date.now()}_${RND}` }),
  });
  assert.equal(badPlan.status, 404);

  const afterPayments = await prisma.payment.count({ where: { userId: user.id } });
  const afterSubs = await prisma.userSubscription.count({ where: { userId: user.id } });
  assert.equal(afterPayments, beforePayments, 'failed checkouts must not create payments');
  assert.equal(afterSubs, beforeSubs, 'failed checkouts must not create subscriptions');
});

test('Gateway isolation: Demo availability does not depend on the real gateways', async () => {
  const { token } = await makeCustomer('isolation');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });

  // No PayHere or NOWPayments credentials exist in this environment, yet
  // the Demo checkout completes — the gateways cannot disable each other.
  const mode = await authJson(token, '/payments/mode');
  assert.equal(mode.body.gateways.demo.enabled, true, 'Demo gateway is always enabled');
  assert.equal(mode.body.mode, 'independent', 'no global payment mode is used');

  const checkout = await authJson(token, '/payments/demo/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: plan.id, billing_option: 'one_time', idempotency_key: `demo_iso_${Date.now()}_${RND}` }),
  });
  assert.equal(checkout.status, 201);
});

test('Production gate: demo checkout is disabled by default and opt-in via env', async () => {
  const seededCustomer = await prisma.user.findUnique({ where: { email: 'customer@luxora.lk' } });
  assert.ok(seededCustomer, 'seeded customer required for the gate test');
  const demoModuleUrl = new URL(`file:///${path.join(backendDir, 'src', 'routes', 'demoPayments.js').replaceAll('\\', '/')}`).href;
  const childScript = `
    import express from 'express';
    import demoRouter from '${demoModuleUrl}';
    import { demoPaymentsEnabled } from '${demoModuleUrl}';
    const app = express();
    app.use(express.json());
    app.use('/api', demoRouter);
    app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
    console.log('FLAG ' + demoPaymentsEnabled());
    const server = app.listen(0, '127.0.0.1', () => console.log('READY ' + server.address().port));
  `;
  const runChild = (demoEnabledEnv) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', childScript], {
      cwd: backendDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PAYMENT_MODE: '',
        DEMO_PAYMENTS_ENABLED: demoEnabledEnv,
        JWT_SECRET: 'gate-test-secret',
        RESEND_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const collect = (chunk) => { out += chunk.toString(); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const watch = (chunk) => {
      const match = String(chunk).match(/READY (\d+)/);
      if (!match) return;
      child.stdout.off('data', watch);
      const finish = async () => {
        try {
          const token = jwt.sign({ id: seededCustomer.id, role: 'CUSTOMER', tokenVersion: 0 }, 'gate-test-secret');
          const checkout = await fetch(`http://127.0.0.1:${match[1]}/api/payments/demo/checkout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ billing_option: 'one_time', idempotency_key: `gate_${RND}` }),
          });
          resolve({ checkoutStatus: checkout.status, flagLine: (out.match(/FLAG \w+/) || [])[0] });
        } catch (error) { reject(error); } finally { child.kill(); }
      };
      finish();
    };
    child.stdout.on('data', watch);
    child.on('exit', (code) => { if (code && code !== 0 && !out.includes('READY')) reject(new Error('child failed: ' + out)); });
  });

  // Default production mode: the zero-cost checkout must be unreachable.
  const disabled = await runChild('');
  assert.equal(disabled.flagLine, 'FLAG false', 'production default must disable the demo gateway');
  assert.equal(disabled.checkoutStatus, 404, 'demo checkout must 404 when disabled');
  // Explicit operator opt-in re-enables it (invalid plan reaches validation = 400).
  const enabled = await runChild('true');
  assert.equal(enabled.flagLine, 'FLAG true', 'DEMO_PAYMENTS_ENABLED=true must opt in');
  assert.equal(enabled.checkoutStatus, 400, 'route must be reachable (validation error) when enabled');
});
