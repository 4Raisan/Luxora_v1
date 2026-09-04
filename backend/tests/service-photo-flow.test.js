import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/config/prisma.js';
import { getObject, removeObject } from '../src/services/storage.js';
import { stopChildProcess } from './helpers/stop-child-process.js';
import './assert-test-database.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5041;
const BASE = `http://127.0.0.1:${PORT}/api`;
const JWT_SECRET = 'service-photo-flow-test-secret-2026';
const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: 'test',
  JWT_SECRET,
  RESEND_API_KEY: '',
  PAYOUT_SCHEDULER_ENABLED: 'false',
};

let server;
let bookingId;
let unrelatedUserId;
const storedKeys = [];

async function startServer() {
  let startupOutput = '';
  let lastHealthError = '';
  server = spawn(process.execPath, ['src/index.js'], { cwd: backendDir, env: SERVER_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (chunk) => { startupOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { startupOutput += chunk.toString(); });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
      lastHealthError = `Health endpoint returned ${response.status}`;
    } catch (error) { lastHealthError = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Service photo test server failed to start (${lastHealthError}). ${startupOutput.trim()}`);
}

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

async function jsonResponse(url, options = {}) {
  const response = await fetch(`${BASE}${url}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function uploadPhoto(booking, token, kind, filename) {
  const bytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x4C, 0x55, 0x58, 0x4F, 0x52, 0x41]);
  const form = new FormData();
  form.append('kind', kind);
  form.append('photos', new Blob([bytes], { type: 'image/png' }), filename);
  const result = await jsonResponse(`/bookings/${booking}/photos`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  return { ...result, bytes };
}

before(startServer);

after(async () => {
  await stopChildProcess(server);
  for (const key of storedKeys) await removeObject(key).catch(() => {});
  if (bookingId) await prisma.booking.delete({ where: { id: bookingId } }).catch(() => {});
  if (unrelatedUserId) await prisma.user.delete({ where: { id: unrelatedUserId } }).catch(() => {});
  await prisma.$disconnect();
});

test('service photos persist through completion and remain visible only to the customer, assigned provider, and admin', async () => {
  const [customer, providerUser, admin, service] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'customer@luxora.lk' } }),
    prisma.user.findUnique({ where: { email: 'provider@luxora.lk' }, include: { provider: true } }),
    prisma.user.findUnique({ where: { email: 'admin@luxora.lk' } }),
    prisma.service.findFirst(),
  ]);
  assert.ok(customer && providerUser?.provider && admin && service, 'Seeded customer, provider, admin, and service are required');

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const unrelated = await prisma.user.create({
    data: { name: 'Unrelated Customer', email: `photo-outsider-${suffix}@test.luxora`, passwordHash: 'not-used', role: 'CUSTOMER' },
  });
  unrelatedUserId = unrelated.id;

  const booking = await prisma.booking.create({
    data: {
      userId: customer.id,
      providerId: providerUser.provider.id,
      serviceId: service.id,
      bookingDate: '2099-12-20',
      bookingTime: '09:00',
      town: 'Colombo',
      status: 'ASSIGNED',
      totalPrice: service.price,
      providerEarning: service.providerEarning,
    },
  });
  bookingId = booking.id;

  const customerToken = jwt.sign({ id: customer.id, role: customer.role, tokenVersion: customer.tokenVersion }, JWT_SECRET);
  const providerToken = jwt.sign({ id: providerUser.id, role: providerUser.role, tokenVersion: providerUser.tokenVersion }, JWT_SECRET);
  const adminToken = jwt.sign({ id: admin.id, role: admin.role, tokenVersion: admin.tokenVersion }, JWT_SECRET);
  const unrelatedToken = jwt.sign({ id: unrelated.id, role: unrelated.role, tokenVersion: unrelated.tokenVersion }, JWT_SECRET);

  const empty = await jsonResponse(`/bookings/${booking.id}/photos`, { headers: authHeaders(providerToken) });
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.body.photos, []);

  const invalidAfter = await uploadPhoto(booking.id, providerToken, 'AFTER', 'too-early.png');
  assert.equal(invalidAfter.response.status, 400, 'AFTER photos must be rejected before the service starts');

  const beforeUpload = await uploadPhoto(booking.id, providerToken, 'BEFORE', 'arrival.png');
  assert.equal(beforeUpload.response.status, 201, JSON.stringify(beforeUpload.body));
  assert.equal(beforeUpload.body.photos[0].kind, 'BEFORE');

  const beforeRecord = await prisma.servicePhoto.findUnique({ where: { id: beforeUpload.body.photos[0].id } });
  assert.ok(beforeRecord);
  storedKeys.push(beforeRecord.filePath);
  assert.deepEqual(await getObject(beforeRecord.filePath), beforeUpload.bytes, 'Uploaded bytes must persist in private storage');

  for (const [role, token] of [['provider', providerToken], ['customer', customerToken], ['admin', adminToken]]) {
    const listing = await jsonResponse(`/bookings/${booking.id}/photos`, { headers: authHeaders(token) });
    assert.equal(listing.response.status, 200, `${role} must be allowed to list booking photos`);
    assert.equal(listing.body.photos.length, 1);
    assert.equal(listing.body.photos[0].filePath, undefined, 'Private storage keys must never be exposed');
  }

  const forbiddenList = await jsonResponse(`/bookings/${booking.id}/photos`, { headers: authHeaders(unrelatedToken) });
  assert.equal(forbiddenList.response.status, 403, 'Unrelated customers must not list photos');
  const unauthenticatedList = await jsonResponse(`/bookings/${booking.id}/photos`);
  assert.equal(unauthenticatedList.response.status, 401, 'Unauthenticated users must not list photos');

  const photoUrl = beforeUpload.body.photos[0].url.replace('/api', '');
  const customerImage = await fetch(`${BASE}${photoUrl}`, { headers: authHeaders(customerToken) });
  assert.equal(customerImage.status, 200);
  assert.equal(customerImage.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await customerImage.arrayBuffer()), beforeUpload.bytes);
  const forbiddenImage = await fetch(`${BASE}${photoUrl}`, { headers: authHeaders(unrelatedToken) });
  assert.equal(forbiddenImage.status, 403, 'Unrelated customers must not retrieve photo bytes');

  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'IN_PROGRESS' } });
  const afterUpload = await uploadPhoto(booking.id, providerToken, 'AFTER', 'completed.png');
  assert.equal(afterUpload.response.status, 201, JSON.stringify(afterUpload.body));
  const afterRecord = await prisma.servicePhoto.findUnique({ where: { id: afterUpload.body.photos[0].id } });
  storedKeys.push(afterRecord.filePath);
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } });

  const lateUpload = await uploadPhoto(booking.id, providerToken, 'AFTER', 'late.png');
  assert.equal(lateUpload.response.status, 400, 'Photo uploads must close after completion');

  await stopChildProcess(server);
  await startServer();
  for (const [role, token] of [['provider', providerToken], ['customer', customerToken], ['admin', adminToken]]) {
    const persisted = await jsonResponse(`/bookings/${booking.id}/photos`, { headers: authHeaders(token) });
    assert.equal(persisted.response.status, 200, `${role} must retain access after server restart and completion`);
    assert.deepEqual(persisted.body.photos.map((photo) => photo.kind), ['BEFORE', 'AFTER']);
  }
});
