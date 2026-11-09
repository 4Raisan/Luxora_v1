import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { prisma } from '../src/config/prisma.js';
import { stopChildProcess } from './helpers/stop-child-process.js';
import { colomboDate } from './helpers/colombo-date.js';
import { queueMonthlyPayouts } from '../src/services/payouts.js';
import { removeObject } from '../src/services/storage.js';
import './assert-test-database.js';

test('real distributed services preserve purchasing, booking, PIN/photo completion, cancellation, refunds and realtime', { skip: !process.env.TEST_DISTRIBUTED_REDIS_URL, timeout: 90000 }, async t => {
  const redisUrl = new URL(process.env.TEST_DISTRIBUTED_REDIS_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(redisUrl.hostname) && redisUrl.pathname === '/14', 'Distributed tests require isolated local Redis database 14');
  const testRedis = new Redis(redisUrl.toString());
  await testRedis.flushdb();
  t.after(() => testRedis.quit());
  const backendDir = fileURLToPath(new URL('../', import.meta.url));
  const processes = [];
  let evidenceBookingId;
  const secret = crypto.randomBytes(32).toString('hex');
  const env = { ...process.env, NODE_ENV: 'test', LUXORA_RUNTIME: 'serverless', REDIS_URL: process.env.TEST_DISTRIBUTED_REDIS_URL, JWT_SECRET: secret, BANK_ENCRYPTION_KEY: process.env.BANK_ENCRYPTION_KEY || secret, RESEND_API_KEY: '', DEMO_PAYMENTS_ENABLED: 'true', PAYMENT_MODE: 'demo', TRUST_PROXY: '1' };
  t.after(async () => {
    await Promise.all(processes.map(child => stopChildProcess(child)));
    if (evidenceBookingId) {
      const photos = await prisma.servicePhoto.findMany({ where: { bookingId: evidenceBookingId }, select: { filePath: true } });
      await Promise.all(photos.map(photo => removeObject(photo.filePath)));
    }
    await prisma.$disconnect();
  });
  async function start(file, port, extra) {
    const child = spawn(process.execPath, [file], { cwd: backendDir, env: { ...env, PORT: String(port), ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    processes.push(child);
    let output = '';
    const record = chunk => { output = (output + chunk).slice(-12000); };
    child.stdout.on('data', record);
    child.stderr.on('data', record);
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(output);
      try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Service failed to start: ${output}`);
  }
  await Promise.all(['accounts', 'bookings', 'payments', 'engagement'].map((name, index) => start('src/index.js', 5181 + index, { LUXORA_SERVICE: name })));
  await start('src/gateway.js', 5185, Object.fromEntries(['accounts', 'bookings', 'payments', 'engagement'].map((name, index) => [`${name.toUpperCase()}_SERVICE_URL`, `http://127.0.0.1:${5181 + index}`])));
  const base = 'http://127.0.0.1:5185/api';
  async function api(path, { token, method = 'GET', data, expected = 200 } = {}) {
    const form = data instanceof FormData;
    const options = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data && !form ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(15000) };
    if (data) options.body = form ? data : JSON.stringify(data);
    const response = await fetch(base + path, options);
    const body = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(body)}`);
    return body;
  }
  const suffix = crypto.randomUUID();
  const password = crypto.randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);
  const category = await prisma.category.create({ data: { name: `Distributed-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, title: 'Distributed service', price: 9000, providerEarning: 6000 } });
  const plan = await prisma.subscriptionPlan.create({ data: { title: `Distributed plan ${suffix}`, type: 'Single Package', priceMonthly: 9000, features: '[]', entitlements: { create: { categoryId: category.id, units: 3 } } } });
  async function identity(role, extra = {}) {
    const user = await prisma.user.create({ data: { name: role, email: `${role.toLowerCase()}-${suffix}@test.luxora`, passwordHash, role, town: 'Colombo', addressDistrict: 'Western', addressStreet: 'Test street', ...extra } });
    const login = await api('/auth/login', { method: 'POST', data: { email: user.email, password } });
    return { user, token: login.token };
  }
  const customer = await identity('CUSTOMER');
  const admin = await identity('ADMIN');
  const provider = await identity('PROVIDER', { provider: { create: { category: category.name, serviceTowns: 'Colombo', kycStatus: 'APPROVED' } } });
  await api('/bookings/my', { expected: 401 });
  await api('/admin/bookings', { token: customer.token, expected: 403 });
  const checkoutData = { plan_id: plan.id, billing_option: 'one_time', idempotency_key: `distributed-${suffix}` };
  const purchase = await api('/payments/demo/checkout', { method: 'POST', token: customer.token, data: checkoutData, expected: 201 });
  await api('/payments/demo/checkout', { method: 'POST', token: customer.token, data: checkoutData });
  assert.equal(await prisma.payment.count({ where: { idempotencyKey: checkoutData.idempotency_key } }), 1);
  assert.ok((await api('/subscriptions/entitlements', { token: customer.token })).entitlements.some(item => item.category_id === category.id && item.remaining_units === 3));

  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${base}/realtime?token=${encodeURIComponent(customer.token)}`, { signal: controller.signal });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  await reader.read(); // connected handshake: subscription is ready before mutation
  const booking = await api('/bookings', { method: 'POST', token: customer.token, data: { service_id: service.id, booking_date: colomboDate(2), booking_time: '09:00' }, expected: 201 });
  let received = '';
  const deadline = setTimeout(() => controller.abort(), 10000);
  while (!received.includes('event: BOOKING_CREATED')) received += decoder.decode((await reader.read()).value || new Uint8Array());
  clearTimeout(deadline);
  assert.ok(received.includes('BOOKING_CREATED'), 'events must cross bookings and engagement processes');
  controller.abort();
  const id = booking.booking_id;
  evidenceBookingId = id;
  const record = await prisma.booking.findUnique({ where: { id } });
  assert.equal(record.status, 'ASSIGNED');
  const providerRecord = await prisma.provider.findUnique({ where: { userId: provider.user.id } });
  assert.equal(record.providerId, providerRecord.id);
  const pins = await api(`/bookings/${id}/pins`, { token: customer.token });
  const evidence = async kind => {
    const form = new FormData();
    form.set('kind', kind);
    form.append('photos', new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], { type: 'image/png' }), 'evidence.png');
    return api(`/bookings/${id}/photos`, { token: provider.token, method: 'POST', data: form, expected: 201 });
  };
  await evidence('BEFORE');
  await api(`/bookings/${id}/status`, { token: provider.token, method: 'PUT', data: { status: 'in_progress', pin_code: pins.start_pin } });
  await api(`/bookings/${id}/cancel`, { token: customer.token, method: 'PUT', expected: 400 });
  const completion = await api(`/bookings/${id}/pins`, { token: customer.token });
  await evidence('AFTER');
  await api(`/bookings/${id}/status`, { token: provider.token, method: 'PUT', data: { status: 'completed', pin_code: completion.completion_pin } });
  assert.equal(Number((await prisma.provider.findUnique({ where: { id: providerRecord.id } })).earnings), 6000);
  const bank = { bank_name: 'Bank of Ceylon', account_holder: 'Provider', account_number: '12345678', branch: 'Original branch' };
  await api('/provider/bank-accounts', { token: provider.token, method: 'POST', data: bank, expected: 201 });
  const payouts = await queueMonthlyPayouts({ period: '2099-01', client: {
    provider: { findMany: args => prisma.provider.findMany({ ...args, where: { ...args.where, id: providerRecord.id } }) },
    $transaction: prisma.$transaction.bind(prisma),
  } });
  assert.equal(payouts.length, 1);
  await api('/provider/bank-accounts', { token: provider.token, method: 'POST', data: { ...bank, account_number: '87654321', branch: 'Changed branch' } });
  const payoutHistory = await api('/admin/payouts', { token: admin.token });
  const frozen = payoutHistory.find(row => row.id === payouts[0].id);
  assert.equal(frozen.branch, 'Original branch');
  assert.ok(frozen.account_number.endsWith('5678'));
  const cancellable = await api('/bookings', { method: 'POST', token: customer.token, data: { service_id: service.id, booking_date: colomboDate(3), booking_time: '09:00' }, expected: 201 });
  await api(`/bookings/${cancellable.booking_id}/cancel`, { token: customer.token, method: 'PUT' });
  const remaining = await api('/subscriptions/entitlements', { token: customer.token });
  assert.equal(remaining.entitlements.find(item => item.category_id === category.id).remaining_units, 2);
  await api('/payments/refunds', { method: 'POST', token: customer.token, data: { payment_id: purchase.payment.id, amount: 0.001, reason: 'Precision validation' }, expected: 400 });
  const refund = await api('/payments/refunds', { method: 'POST', token: customer.token, data: { payment_id: purchase.payment.id, amount: 10, reason: 'Distributed refund' }, expected: 201 });
  for (const action of ['review', 'approve', 'process', 'complete']) {
    await api(`/admin/refunds/${refund.refund.id}`, { method: 'PUT', token: admin.token, data: { action, provider_ref: `distributed-${suffix}` } });
  }
  assert.equal((await api('/payments/refunds/my', { token: customer.token }))[0].status, 'completed');
  // A second engagement instance must continue the same wizard without sticky routing.
  const chat = await api('/chat', { method: 'POST', token: customer.token, data: { sessionId: `chat-${suffix}`, structuredPayload: { wizardType: 'SPECIAL_ASK', stepAction: 'START', title: 'Persisted request title', category: 'Auto Care' } } });
  await start('src/index.js', 5186, { LUXORA_SERVICE: 'engagement' });
  const continued = await fetch('http://127.0.0.1:5186/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` }, body: JSON.stringify({ sessionId: chat.sessionId, structuredPayload: { wizardType: 'SPECIAL_ASK', stepAction: 'EDIT' } }) });
  assert.equal(continued.status, 200);
  assert.ok(JSON.stringify(await continued.json()).includes('Persisted request title'));
  await prisma.user.update({ where: { id: customer.user.id }, data: { tokenVersion: { increment: 1 } } });
  await api('/payments/my', { token: customer.token, expected: 403 });
  await api('/bookings/my', { token: customer.token, expected: 403 });
  await api('/notifications', { token: customer.token, expected: 403 });
});
