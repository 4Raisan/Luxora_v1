// Real HTTP routers against the isolated test database; index.js and its schedulers never start.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import './assert-test-database.js';
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import uploadsRouter from '../src/routes/uploads.js';
import adminRouter from '../src/routes/admin.js';
import providerRouter from '../src/routes/provider.js';
import bookingsRouter from '../src/routes/bookings.js';
import { getObject, removeObject, objectStorageEnabled } from '../src/services/storage.js';

const suffix = crypto.randomUUID().replaceAll('-', '');
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = path.join(backendDir, 'private-uploads');
const png = Buffer.from('89504e470d0a1a0a4c55584f5241', 'hex');
const users = [];
const providers = [];
let listener;
let base;
let admin;
let customer;
let category;
let service;
let oldEmailKey;

const ids = (rows) => rows.map((row) => row.id).sort((a, b) => a - b);
const headers = (user) => user ? { Authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion }, JWT_SECRET)}` } : {};
async function request(user, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { ...headers(user), ...options.headers }, signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  return { status: response.status, body };
}
async function makeUser(role = 'PROVIDER', providerData = {}) {
  const user = await prisma.user.create({ data: {
    name: `KYC ${role} ${users.length}`, email: `kyc-${suffix}-${users.length}@test.luxora`,
    passwordHash: 'unused-test-password-hash', role, active: true, emailVerified: true,
    ...(role === 'PROVIDER' ? { provider: { create: { category: category.name, serviceTowns: 'Colombo', kycStatus: 'APPROVED', ...providerData } } } : {}),
  }, include: { provider: true } });
  users.push(user.id);
  if (user.provider) providers.push(user.provider.id);
  return user;
}
async function upload(user, type = 'NIC', files = [{ name: 'front.png' }], field = 'documents') {
  const form = new FormData();
  if (type !== undefined) form.append('document_type', type);
  for (const file of files) form.append(field, new Blob([file.bytes || png], { type: file.mime || 'image/png' }), file.name);
  return request(user, '/provider/kyc-documents', { method: 'POST', body: form });
}
async function accepted(user, type = 'NIC', names = ['front.png']) {
  const result = await upload(user, type, names.map((name) => ({ name })));
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.documents.length, names.length);
  return result.body.documents;
}
const documents = (user) => prisma.kycDocument.findMany({ where: { providerId: user.provider.id }, orderBy: { id: 'asc' } });
const current = async (user) => (await documents(user)).filter((row) => row.supersededAt === null);
async function state(user) {
  const provider = await prisma.provider.findUnique({ where: { id: user.provider.id } });
  return { documents: await documents(user), status: provider.kycStatus, reason: provider.kycRejectionReason };
}
const decide = (user, body, actor = admin) => request(actor, `/admin/providers/${user.provider.id}/kyc`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const audits = (user) => prisma.adminAuditLog.findMany({ where: { adminId: admin.id, targetType: 'Provider', targetId: String(user.provider.id) }, orderBy: { id: 'asc' } });
async function booking() {
  return prisma.booking.create({ data: { userId: customer.id, serviceId: service.id, bookingDate: '2099-12-20', bookingTime: '09:00', town: 'Colombo', status: 'PENDING', totalPrice: 100, providerEarning: 50 } });
}

before(async () => {
  assert.equal(objectStorageEnabled, false, 'Run with local test storage; never write fixtures to a real bucket');
  oldEmailKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = '';
  category = await prisma.category.create({ data: { name: `KYC category ${suffix}` } });
  service = await prisma.service.create({ data: { categoryId: category.id, title: `KYC service ${suffix}`, price: 100, providerEarning: 50 } });
  admin = await makeUser('ADMIN');
  customer = await makeUser('CUSTOMER');
  const app = express();
  app.use(express.json());
  // Uploads deliberately mount before the operational provider KYC gate.
  app.use('/api', uploadsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/provider', providerRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use((error, _req, res, _next) => {
    if (error.name === 'MulterError') return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
    return res.status(error.statusCode || 500).json({ error: error.message });
  });
  listener = await new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  base = `http://127.0.0.1:${listener.address().port}/api`;
});

after(async () => {
  if (listener) await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  try {
    const rows = await prisma.kycDocument.findMany({ where: { providerId: { in: providers } } });
    for (const row of rows) await removeObject(row.filePath);
    await prisma.booking.deleteMany({ where: { userId: { in: users } } });
    await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (service) await prisma.service.delete({ where: { id: service.id } });
    if (category) await prisma.category.delete({ where: { id: category.id } });
  } finally {
    if (oldEmailKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldEmailKey;
    await prisma.$disconnect();
  }
});

describe('KYC document supersession', { concurrency: false }, () => {
  test('first upload creates current rows and resets approved KYC to pending', async () => {
    const user = await makeUser();
    const uploaded = await accepted(user);
    assert.deepEqual(ids(await current(user)), ids(uploaded));
    assert.equal((await state(user)).status, 'PENDING');
    assert.deepEqual(await getObject((await current(user))[0].filePath), png);
  });

  test('second upload supersedes the previous type without deleting its history', async () => {
    const user = await makeUser();
    const first = await accepted(user);
    const second = await accepted(user, 'NIC', ['replacement.png']);
    const rows = await documents(user);
    assert.equal(rows.length, 2);
    assert.ok(rows.find((row) => row.id === first[0].id).supersededAt instanceof Date);
    assert.deepEqual(ids(await current(user)), ids(second));
  });

  test('third upload supersedes only current rows and preserves earlier supersession timestamps', async () => {
    const user = await makeUser();
    await accepted(user);
    await accepted(user, 'NIC', ['second.png']);
    const before = await documents(user);
    const third = await accepted(user, 'NIC', ['third.png']);
    const rows = await documents(user);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].supersededAt.getTime(), before[0].supersededAt.getTime());
    assert.ok(rows[1].supersededAt instanceof Date);
    assert.deepEqual(ids(await current(user)), ids(third));
  });

  test('multi-file NIC front and back remain current as one complete replacement set', async () => {
    const user = await makeUser();
    const old = await accepted(user, 'NIC', ['old-front.png', 'old-back.png']);
    const next = await accepted(user, 'NIC', ['front.png', 'back.png']);
    assert.deepEqual(ids(await current(user)), ids(next));
    assert.equal((await documents(user)).filter((row) => ids(old).includes(row.id) && row.supersededAt !== null).length, 2);
  });

  test('replacing NIC never supersedes current PASSPORT or SELFIE documents', async () => {
    const user = await makeUser();
    await accepted(user);
    const passport = await accepted(user, 'PASSPORT');
    const selfie = await accepted(user, 'SELFIE');
    const nic = await accepted(user, 'NIC', ['new.png']);
    assert.deepEqual(ids(await current(user)), ids([...passport, ...selfie, ...nic]));
  });

  test('successful re-upload clears a previous rejection reason', async () => {
    const user = await makeUser('PROVIDER', { kycStatus: 'REJECTED', kycRejectionReason: 'Unreadable identity document' });
    await accepted(user);
    const fresh = await state(user);
    assert.equal(fresh.status, 'PENDING');
    assert.equal(fresh.reason, null);
  });

  test('invalid type, empty files, and invalid content preserve old rows and approval', async () => {
    const user = await makeUser();
    await accepted(user);
    await prisma.provider.update({ where: { id: user.provider.id }, data: { kycStatus: 'APPROVED' } });
    const before = await state(user);
    assert.equal((await upload(user, 'OTHER')).status, 400);
    assert.equal((await upload(user, 'NIC', [])).status, 400);
    assert.equal((await upload(user, 'NIC', [{ name: 'valid.png' }, { name: 'invalid.png', bytes: Buffer.from('not an image') }])).status, 415);
    assert.deepEqual(await state(user), before);
  });

  test('Multer rejects more than three files, unexpected fields, and oversized files without changing KYC', async () => {
    const user = await makeUser('PROVIDER', { kycStatus: 'REJECTED', kycRejectionReason: 'Keep this reason' });
    await accepted(user);
    await prisma.provider.update({ where: { id: user.provider.id }, data: { kycStatus: 'REJECTED', kycRejectionReason: 'Keep this reason' } });
    const before = await state(user);
    assert.equal((await upload(user, 'NIC', [1, 2, 3, 4].map((n) => ({ name: `${n}.png` })))).status, 400);
    assert.equal((await upload(user, 'NIC', [{ name: 'front.png' }], 'wrong')).status, 400);
    assert.equal((await upload(user, 'NIC', [{ name: 'huge.png', bytes: Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]) }])).status, 413);
    assert.deepEqual(await state(user), before);
  });

  test('storage failure on the second file preserves rows/status and removes the first staged file', async (t) => {
    const user = await makeUser();
    await accepted(user);
    await prisma.provider.update({ where: { id: user.provider.id }, data: { kycStatus: 'APPROVED' } });
    const before = await state(user);
    const write = fs.writeFileSync;
    let writes = 0;
    let staged;
    const mocked = t.mock.method(fs, 'writeFileSync', function (filename, ...args) {
      if (path.dirname(path.resolve(String(filename))) === localRoot) {
        writes += 1;
        if (writes === 2) throw new Error('Injected test storage failure');
        staged = filename;
      }
      return write.call(this, filename, ...args);
    });
    try {
      assert.equal((await upload(user, 'NIC', [{ name: 'front.png' }, { name: 'back.png' }])).status, 500);
    } finally { mocked.mock.restore(); }
    assert.equal(writes, 2);
    assert.deepEqual(await state(user), before);
    assert.equal(fs.existsSync(staged), false);
  });

  test('database insert failure rolls back supersession and provider status', async () => {
    const user = await makeUser();
    await accepted(user);
    await prisma.provider.update({ where: { id: user.provider.id }, data: { kycStatus: 'APPROVED' } });
    const before = await state(user);
    // NOT VALID skips validating existing rows; only the fixed fixture marker fails.
    await prisma.$executeRaw`ALTER TABLE "luxora_test"."kyc_documents" DROP CONSTRAINT IF EXISTS "kyc_supersession_insert_guard"`;
    await prisma.$executeRaw`ALTER TABLE "luxora_test"."kyc_documents" ADD CONSTRAINT "kyc_supersession_insert_guard" CHECK ("originalName" <> 'kyc-db-fail.png') NOT VALID`;
    try {
      assert.equal((await upload(user, 'NIC', [{ name: 'kyc-db-fail.png' }])).status, 500);
      assert.deepEqual(await state(user), before);
    } finally {
      await prisma.$executeRaw`ALTER TABLE "luxora_test"."kyc_documents" DROP CONSTRAINT IF EXISTS "kyc_supersession_insert_guard"`;
    }
  });

  test('simultaneous uploads leave exactly one complete final set and retain both histories', async () => {
    const user = await makeUser();
    const old = await accepted(user);
    const [a, b] = await Promise.all([
      accepted(user, 'NIC', ['a-front.png', 'a-back.png']),
      accepted(user, 'NIC', ['b-front.png', 'b-back.png', 'b-extra.png']),
    ]);
    const active = ids(await current(user));
    assert.ok(JSON.stringify(active) === JSON.stringify(ids(a)) || JSON.stringify(active) === JSON.stringify(ids(b)), 'Concurrent requests must not mix or merge their sets');
    const rows = await documents(user);
    assert.equal(rows.length, old.length + a.length + b.length);
    assert.ok(rows.filter((row) => !active.includes(row.id)).every((row) => row.supersededAt instanceof Date));
    assert.equal((await state(user)).status, 'PENDING');
  });

  test('admin detail exposes historical supersededAt and exact current_document_ids without storage paths', async () => {
    const user = await makeUser();
    await accepted(user);
    const next = await accepted(user, 'NIC', ['front.png', 'back.png']);
    const detail = await request(admin, `/admin/providers/${user.provider.id}`);
    assert.equal(detail.status, 200);
    assert.deepEqual([...detail.body.current_document_ids].sort((a, b) => a - b), ids(next));
    assert.equal(detail.body.documents.length, 3);
    assert.equal(detail.body.documents.filter((row) => row.supersededAt !== null).length, 1);
    for (const row of detail.body.documents) {
      assert.ok(Object.hasOwn(row, 'supersededAt'));
      assert.equal(row.filePath, undefined);
      assert.equal(row.url, `/api/uploads/kyc/${row.id}`);
    }
  });

  test('stale admin review after another upload returns 409 without a decision or audit', async () => {
    const user = await makeUser();
    const old = await accepted(user);
    await accepted(user, 'NIC', ['new.png']);
    const before = await state(user);
    const result = await decide(user, { status: 'approved', document_ids: ids(old) });
    assert.equal(result.status, 409, JSON.stringify(result.body));
    assert.deepEqual(await state(user), before);
    assert.deepEqual(await audits(user), []);
  });

  test('missing, partial, duplicate, and foreign document IDs cannot approve a documented provider', async () => {
    const user = await makeUser();
    const rows = await accepted(user, 'NIC', ['front.png', 'back.png']);
    const foreign = await accepted(await makeUser());
    for (const documentIds of [undefined, [], [rows[0].id], [rows[0].id, rows[0].id], ids([...rows, ...foreign])]) {
      const result = await decide(user, { status: 'approved', ...(documentIds === undefined ? {} : { document_ids: documentIds }) });
      assert.equal(result.status, 409, JSON.stringify(result.body));
    }
    assert.equal((await state(user)).status, 'PENDING');
    assert.deepEqual(await audits(user), []);
  });

  test('approval accepts the exact current ID set in any order and transactionally audits those IDs', async () => {
    const user = await makeUser();
    const rows = await accepted(user, 'NIC', ['front.png', 'back.png']);
    const result = await decide(user, { status: 'approved', document_ids: ids(rows).reverse() });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal((await state(user)).status, 'APPROVED');
    const logs = await audits(user);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'KYC_APPROVED');
    assert.deepEqual([...logs[0].details.documentIds].sort((a, b) => a - b), ids(rows));
  });

  test('rejection with exact current IDs persists the reason and audited document IDs', async () => {
    const user = await makeUser();
    const rows = await accepted(user);
    const result = await decide(user, { status: 'rejected', rejection_reason: 'Identity image is unreadable', document_ids: ids(rows) });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const fresh = await state(user);
    assert.equal(fresh.status, 'REJECTED');
    assert.equal(fresh.reason, 'Identity image is unreadable');
    const logs = await audits(user);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'KYC_REJECTED');
    assert.deepEqual(logs[0].details.documentIds, ids(rows));
  });

  test('audit database failure rolls back the admin decision', async () => {
    const user = await makeUser();
    const rows = await accepted(user);
    const before = await state(user);
    // NOT VALID leaves existing audit rows alone; the fixed action marker fails.
    await prisma.$executeRaw`ALTER TABLE "luxora_test"."admin_audit_logs" DROP CONSTRAINT IF EXISTS "kyc_audit_insert_guard"`;
    await prisma.$executeRaw`ALTER TABLE "luxora_test"."admin_audit_logs" ADD CONSTRAINT "kyc_audit_insert_guard" CHECK ("action" <> 'KYC_APPROVED' OR "targetType" <> 'Provider') NOT VALID`;
    try {
      assert.equal((await decide(user, { status: 'approved', document_ids: ids(rows) })).status, 500);
      assert.deepEqual(await state(user), before);
      assert.deepEqual(await audits(user), []);
    } finally {
      await prisma.$executeRaw`ALTER TABLE "luxora_test"."admin_audit_logs" DROP CONSTRAINT IF EXISTS "kyc_audit_insert_guard"`;
    }
  });

  test('successful upload immediately blocks operational access and claiming pending bookings', async () => {
    const user = await makeUser();
    const pending = await booking();
    await accepted(user);
    const operations = await request(user, '/provider/earnings');
    assert.equal(operations.status, 403);
    assert.match(operations.body.error, /KYC/i);
    assert.equal((await request(user, '/bookings/pending')).status, 403);
    const claim = await request(user, `/bookings/${pending.id}/claim`, { method: 'POST' });
    assert.equal(claim.status, 403);
    assert.match(claim.body.error, /KYC/i);
    const unchanged = await prisma.booking.findUnique({ where: { id: pending.id } });
    assert.equal(unchanged.status, 'PENDING');
    assert.equal(unchanged.providerId, null);
  });

  test('legacy approved provider with zero documents can still access and claim eligible work', async () => {
    const user = await makeUser();
    const pending = await booking();
    assert.deepEqual(await documents(user), []);
    assert.equal((await request(user, '/provider/earnings')).status, 200);
    const claim = await request(user, `/bookings/${pending.id}/claim`, { method: 'POST' });
    assert.equal(claim.status, 200, JSON.stringify(claim.body));
    assert.equal((await prisma.booking.findUnique({ where: { id: pending.id } })).providerId, user.provider.id);
  });

  test('legacy zero-document provider can be approved without document_ids', async () => {
    const user = await makeUser('PROVIDER', { kycStatus: 'PENDING' });
    const result = await decide(user, { status: 'approved' });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal((await state(user)).status, 'APPROVED');
    assert.deepEqual((await audits(user))[0].details.documentIds, []);
  });

  test('historical files remain readable only by active owner and admin, not stranger/customer/inactive/anonymous', async () => {
    const user = await makeUser();
    const stranger = await makeUser();
    const old = await accepted(user);
    await accepted(user, 'NIC', ['new.png']);
    const route = `${base}/uploads/kyc/${old[0].id}`;
    for (const actor of [user, admin]) {
      const response = await fetch(route, { headers: headers(actor) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    }
    for (const actor of [stranger, customer, null]) {
      const response = await fetch(route, { headers: headers(actor) });
      assert.equal(response.status, actor ? 403 : 401);
      await response.arrayBuffer();
    }
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    const inactive = await fetch(route, { headers: headers(user) });
    assert.equal(inactive.status, 403);
    await inactive.arrayBuffer();
  });

  test('upload is PROVIDER-only and review is ADMIN-only', async () => {
    const user = await makeUser();
    for (const actor of [admin, customer, null]) assert.equal((await upload(actor)).status, actor ? 403 : 401);
    const rows = await accepted(user);
    for (const actor of [user, customer, null]) {
      assert.equal((await decide(user, { status: 'approved', document_ids: ids(rows) }, actor)).status, actor ? 403 : 401);
    }
    assert.equal((await state(user)).status, 'PENDING');
  });

  test('actual migration preserves separately uploaded legacy NIC sides and adds a non-unique current lookup index', async () => {
    const migration = fs.readFileSync(path.join(backendDir, 'prisma/migrations/20260917100000_kyc_document_supersession/migration.sql'), 'utf8');
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "kyc_documents" ("id" INTEGER PRIMARY KEY, "providerId" INTEGER NOT NULL, "documentType" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL) ON COMMIT DROP');
      await tx.$executeRawUnsafe(`INSERT INTO pg_temp."kyc_documents" VALUES (1, 10, 'NIC', '2026-01-01'), (2, 10, 'NIC', '2026-01-02'), (3, 10, 'PASSPORT', '2026-01-03'), (4, 20, 'NIC', '2026-01-04')`);
      // Every table reference is scoped to this connection's temporary table;
      // real rows are never touched.
      const scoped = migration.replaceAll('"kyc_documents"', 'pg_temp."kyc_documents"');
      for (const statement of scoped.replace(/--[^\n]*/g, '').split(';').map((part) => part.trim()).filter(Boolean)) {
        await tx.$executeRawUnsafe(statement);
      }
      const rows = await tx.$queryRawUnsafe('SELECT * FROM pg_temp."kyc_documents" ORDER BY "id"');
      assert.equal(rows.length, 4);
      assert.ok(rows.every((row) => row.supersededAt === null), 'Migration must not discard separately uploaded legacy front/back sides');
      assert.deepEqual(rows.map((row) => [row.id, row.providerId, row.documentType]), [[1, 10, 'NIC'], [2, 10, 'NIC'], [3, 10, 'PASSPORT'], [4, 20, 'NIC']]);
      const indexes = await tx.$queryRawUnsafe(`SELECT indexdef FROM pg_indexes WHERE schemaname = (SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema()) AND tablename = 'kyc_documents'`);
      const lookup = indexes.find((row) => row.indexdef.includes('supersededAt'));
      assert.ok(lookup);
      assert.doesNotMatch(lookup.indexdef, /UNIQUE/);
      await tx.$executeRawUnsafe(`INSERT INTO pg_temp."kyc_documents" ("id", "providerId", "documentType", "createdAt") VALUES (5, 10, 'NIC', NOW())`);
    });
  });
});
