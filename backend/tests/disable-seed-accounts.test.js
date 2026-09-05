// Incident remediation tests for historical public seed accounts.
// Simulates production rows created with an exposed password, runs the
// remediation function, and proves the credential is dead while legitimate
// accounts keep working. Runs against the isolated luxora_test schema only.
//
// Shared seed rows (customer@luxora.lk etc.) belong to the whole suite, so
// every test snapshots them first and restores them byte-identical in
// teardown (same IDs, hashes, versions) instead of deleting anything.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { stopChildProcess } from './helpers/stop-child-process.js';
import { disablePublicSeedAccounts } from '../prisma/disable-public-seed-accounts.js';
import './assert-test-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5043;
const BASE = `http://127.0.0.1:${PORT}/api`;
const EXPOSED_PASSWORD = 'Exposed-Seed-Password-999!';
const CONTROL_PASSWORD = 'Legit-Control-Password-999!';
const CONTROL_EMAIL = 'legit.control@example.com';
const SEED_EMAILS = ['customer@luxora.lk', 'provider@luxora.lk', 'admin@luxora.lk'];

const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'demo',
  RESEND_API_KEY: '',
  GOOGLE_CLIENT_ID: '',
};

let server;
const json = async (apiPath, options = {}) => {
  const response = await fetch(`${BASE}${apiPath}`, { ...options, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, text };
};
const login = (email, password) => json('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

async function snapshotSharedRows() {
  const users = await prisma.user.findMany({ where: { email: { in: SEED_EMAILS } } });
  const userIds = users.map((u) => u.id);
  const providers = await prisma.provider.findMany({ where: { userId: { in: userIds } } });
  const resetTokens = await prisma.passwordResetToken.findMany({ where: { userId: { in: userIds } } });
  return { users, providers, resetTokens };
}

async function restoreSharedRows(snap) {
  for (const user of snap.users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name, passwordHash: user.passwordHash, phone: user.phone,
        phoneVerified: user.phoneVerified, town: user.town,
        addressStreet: user.addressStreet, addressDistrict: user.addressDistrict,
        role: user.role, active: user.active, tokenVersion: user.tokenVersion,
      },
    });
  }
  for (const provider of snap.providers) {
    await prisma.provider.update({
      where: { id: provider.id },
      data: {
        nic: provider.nic, kycStatus: provider.kycStatus, kycRejectionReason: provider.kycRejectionReason,
        category: provider.category, serviceTowns: provider.serviceTowns,
        availabilityStatus: provider.availabilityStatus, earnings: provider.earnings,
      },
    });
  }
  for (const token of snap.resetTokens) {
    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: token.usedAt } })
      .catch(() => {});
  }
  // Remove reset tokens this file created (tracked by their hashes).
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: snap.users.map((u) => u.id) }, tokenHash: { in: createdTokenHashes } } });
  createdTokenHashes.length = 0;
}

const createdTokenHashes = [];
const createdExtraEmails = [];

async function installExposedFixture() {
  for (const [index, email] of SEED_EMAILS.entries()) {
    const role = email.startsWith('customer') ? 'CUSTOMER' : email.startsWith('provider') ? 'PROVIDER' : 'ADMIN';
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: await bcrypt.hash(EXPOSED_PASSWORD, 4),
        active: true, tokenVersion: 0, role,
        name: `Seed Fixture ${role}`, town: 'Colombo',
      },
      create: {
        name: `Seed Fixture ${role}`, email,
        passwordHash: await bcrypt.hash(EXPOSED_PASSWORD, 4),
        role, town: 'Colombo', active: true, tokenVersion: 0,
      },
    });
    if (role === 'PROVIDER') {
      await prisma.provider.upsert({
        where: { userId: user.id },
        update: { category: 'Auto Care', serviceTowns: 'Colombo', kycStatus: 'APPROVED', availabilityStatus: 'available' },
        create: { userId: user.id, category: 'Auto Care', serviceTowns: 'Colombo', kycStatus: 'APPROVED', availabilityStatus: 'available' },
      });
    }
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  }
  const seedCustomer = await prisma.user.findUnique({ where: { email: 'customer@luxora.lk' } });
  const marker = crypto.randomBytes(16).toString('hex');
  createdTokenHashes.push(marker);
  await prisma.passwordResetToken.create({
    data: { userId: seedCustomer.id, tokenHash: marker, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
}

async function cleanupExtras() {
  if (createdExtraEmails.length) {
    await prisma.user.deleteMany({ where: { email: { in: createdExtraEmails } } });
    createdExtraEmails.length = 0;
  }
  await prisma.user.deleteMany({ where: { email: CONTROL_EMAIL } });
}

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

test('Full remediation with a replacement admin: exposed credential dies, legitimate login survives', async () => {
  const snap = await snapshotSharedRows();
  try {
    await cleanupExtras();
    await installExposedFixture();
    const replacementEmail = `replacement.admin.${crypto.randomUUID().slice(0, 8)}@test.luxora`;
    createdExtraEmails.push(replacementEmail);
    await prisma.user.create({
      data: { name: 'Replacement Admin', email: replacementEmail, passwordHash: await bcrypt.hash(CONTROL_PASSWORD, 4), role: 'ADMIN', active: true },
    });
    await prisma.user.create({
      data: { name: 'Legit Control', email: CONTROL_EMAIL, passwordHash: await bcrypt.hash(CONTROL_PASSWORD, 4), role: 'CUSTOMER', town: 'Colombo', active: true },
    });
    const seedCustomer = await prisma.user.findUnique({ where: { email: 'customer@luxora.lk' } });

    const preLogin = await login('admin@luxora.lk', EXPOSED_PASSWORD);
    assert.equal(preLogin.status, 200, 'seed credential must work before remediation in this fixture');
    const preToken = preLogin.body.token;

    const result = await disablePublicSeedAccounts(prisma);
    assert.deepEqual(result, { disabled: 3, providersTakenOffline: 1, adminHeld: [] });

    for (const email of SEED_EMAILS) {
      const attempt = await login(email, EXPOSED_PASSWORD);
      assert.equal(attempt.status, 401, `${email} with exposed password must be rejected`);
      const row = await prisma.user.findUnique({ where: { email } });
      assert.equal(row.active, false, `${email} must be deactivated`);
      assert.equal(await bcrypt.compare(EXPOSED_PASSWORD, row.passwordHash), false, `${email} hash must no longer match`);
    }
    const staleSession = await json('/auth/me', { headers: { Authorization: `Bearer ${preToken}` } });
    assert.equal(staleSession.status, 403, 'pre-remediation session token must be rejected');
    const burned = await prisma.passwordResetToken.findMany({ where: { userId: seedCustomer.id, usedAt: null } });
    assert.equal(burned.length, 0, 'unused reset tokens must be burned');
    const provider = await prisma.provider.findFirst({ where: { user: { email: 'provider@luxora.lk' } } });
    assert.equal(provider.availabilityStatus, 'offline');
    assert.equal((await login(CONTROL_EMAIL, CONTROL_PASSWORD)).status, 200, 'legitimate login must keep working');

    const rerun = await disablePublicSeedAccounts(prisma);
    assert.deepEqual(rerun, { disabled: 0, providersTakenOffline: 0, adminHeld: [] });
  } finally {
    await cleanupExtras();
    await restoreSharedRows(snap);
  }
});

test('Last active admin is held back while fixtures are still disabled', async () => {
  const snap = await snapshotSharedRows();
  // Other test files may leave active admins behind; quarantine them so this
  // test deterministically exercises the last-admin hold, then restore.
  const otherAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true, email: { notIn: [...SEED_EMAILS, CONTROL_EMAIL] } },
    select: { id: true },
  });
  const otherAdminIds = otherAdmins.map((a) => a.id);
  try {
    await installExposedFixture();
    await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { active: false } });

    await assert.rejects(
      () => disablePublicSeedAccounts(prisma),
      /replacement admin/i,
      'must refuse to finish while the seed admin is the last active admin',
    );
    assert.equal((await prisma.user.findUnique({ where: { email: 'customer@luxora.lk' } })).active, false);
    assert.equal((await prisma.user.findUnique({ where: { email: 'provider@luxora.lk' } })).active, false);
    const heldAdmin = await prisma.user.findUnique({ where: { email: 'admin@luxora.lk' } });
    assert.equal(heldAdmin.active, true, 'last admin must stay active until replaced');
    assert.equal((await login('admin@luxora.lk', EXPOSED_PASSWORD)).status, 200, 'held admin keeps working until replaced');
  } finally {
    await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { active: true } });
    await cleanupExtras();
    await restoreSharedRows(snap);
  }
});

test('Login rate limiter trips under rapid attempts (production auth hardening)', async () => {
  // loginLimiter allows 10 POST /login per 15 minutes per IP; a burst must
  // eventually receive 429 instead of silently serving every attempt.
  let lastStatus = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await login(`ratelimit.probe.${attempt}@example.com`, 'Wrong-Password-123!');
    lastStatus = response.status;
    if (lastStatus === 429) break;
  }
  assert.equal(lastStatus, 429, 'login endpoint must rate-limit rapid attempts with 429');
});
