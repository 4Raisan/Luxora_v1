// V2 Slice 6 — email verification tests. In-process express app mounting the
// real auth router against the isolated test schema (same technique as
// refund-admin.test.js). Outbound email is captured by intercepting the
// Resend API call in fetch — no real email is ever sent, and captured links
// provide the raw tokens the flows need.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import authRouter from '../src/routes/auth.js';
import './assert-test-database.js';

const RND = crypto.randomUUID().slice(0, 8);
process.env.GOOGLE_CLIENT_ID = `test-google-client-${RND}.apps.googleusercontent.com`;

let app;
let listener;
let baseUrl;

let adminUser; // for role-takeover assertions if ever needed
const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET);

// Captured outbound emails (Resend API bodies) with the fetch stub installed
// for the whole file; every raw verification/reset token comes from here.
const capturedEmails = [];
const realFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('api.resend.com')) {
    capturedEmails.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ id: 'test-email' }) };
  }
  if (target.includes('oauth2.googleapis.com/tokeninfo')) {
    return { ok: true, status: 200, json: async () => googleTokenInfo };
  }
  return realFetch(url, options);
};
let googleTokenInfo = {};

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const tokenFromLastEmail = () => {
  const html = capturedEmails[capturedEmails.length - 1].html;
  return decodeURIComponent(html.match(/token=([^"<\s]+)/)[1]);
};

const json = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
};

const registerAccount = async (label) => {
  const email = `s6.${label}.${RND}@test.luxora`;
  const res = await json('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: `S6 ${label}`, email, password: 'Passw0rd123', role: 'customer' }),
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { user: await prisma.user.findUnique({ where: { email } }), email, response: res };
};

before(async () => {
  // Non-functional key: the fetch stub above intercepts every Resend call
  // before the network, so no real email is ever sent.
  process.env.RESEND_API_KEY = `test-resend-${RND}`;

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  listener = app.listen(0);
  baseUrl = `http://127.0.0.1:${listener.address().port}/api`;

  adminUser = await prisma.user.create({
    data: { name: `S6 Admin ${RND}`, email: `s6.admin.${RND}@test.luxora`, passwordHash: bcrypt.hashSync('pass123', 10), role: 'ADMIN', active: true },
  });
});

after(async () => {
  global.fetch = realFetch;
  listener.close();
  await prisma.$disconnect();
});

test('registration creates an unverified account and generates a verification email', async () => {
  const { user, email, response } = await registerAccount('reg');
  assert.equal(user.emailVerified, false, 'account starts unverified');
  assert.equal(response.body.user.emailVerified, false, 'flag is exposed to the UI');
  assert.equal(await prisma.emailVerificationToken.count({ where: { userId: user.id, usedAt: null } }), 1, 'one-time token created');

  const emailBody = capturedEmails[capturedEmails.length - 1];
  assert.deepEqual(emailBody.to, [email]);
  assert.equal(emailBody.subject, 'Verify your Luxora email address');
  assert.ok(emailBody.html.includes('Verify my email'), 'purpose + action present');
  assert.ok(emailBody.html.includes('24 hours'), 'expiry communicated');
  assert.ok(emailBody.html.includes('/verify-email?token='), 'verification link present');
  assert.ok(!emailBody.html.includes('Passw0rd123'), 'no passwords in the email');
  assert.ok(!/[0-9a-f]{64}/.test(emailBody.html.split('token=')[1]?.split('"')[0] || ''), 'link carries the raw token only as intended');
});

test('an unverified account can log in and sees the flag (informational, not a gate)', async () => {
  const { email } = await registerAccount('login');
  const res = await json('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Passw0rd123' }) });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.emailVerified, false);
});

test('valid verification marks the account verified and consumes the token', async () => {
  const { user } = await registerAccount('valid');
  const token = tokenFromLastEmail();
  const res = await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
  assert.equal(res.status, 200);
  assert.equal(res.body.token, undefined, 'verification response never issues auth material');
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(fresh.emailVerified, true);
  const record = await prisma.emailVerificationToken.findFirst({ where: { userId: user.id } });
  assert.notEqual(record.tokenHash, token, 'only the hash is stored');
  assert.equal(record.tokenHash, sha256(token));
  assert.ok(record.usedAt, 'token marked used');
});

test('reused, expired, malformed, and random tokens are rejected', async () => {
  const { user } = await registerAccount('reuse');
  const token = tokenFromLastEmail();
  assert.equal((await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })).status, 200);
  const replay = await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
  assert.equal(replay.status, 400, 'replay fails');

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash: sha256(`expired-${RND}`), expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal((await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: `expired-${RND}` }) })).status, 400, 'expired fails');

  for (const bad of ['', 'malformed', crypto.randomUUID(), token.replace(/[0-9a-f]/gi, 'x')]) {
    const res = await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: bad }) });
    assert.equal(res.status, 400, `bad token rejected: ${bad.slice(0, 12)}`);
  }
});

test('a token verifies only its own account', async () => {
  const a = await registerAccount('own-a');
  const b = await registerAccount('own-b');
  const token = tokenFromLastEmail(); // b's token
  assert.equal((await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })).status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: b.user.id } })).emailVerified, true);
  assert.equal((await prisma.user.findUnique({ where: { id: a.user.id } })).emailVerified, false, 'account A untouched');
});

test('concurrent verification requests settle exactly once', async () => {
  const { user } = await registerAccount('concurrent');
  const token = tokenFromLastEmail();
  const results = await Promise.allSettled([
    json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
    json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
    json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  ]);
  const outcomes = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.status);
  assert.equal(outcomes.filter((s) => s === 200).length, 1, 'exactly one claim wins');
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).emailVerified, true);
});

test('resend invalidates the previous token and the new one works', async () => {
  const { user, email } = await registerAccount('resend');
  const oldToken = tokenFromLastEmail();
  const res = await json('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
  assert.equal(res.status, 200);
  const newToken = tokenFromLastEmail();
  assert.notEqual(newToken, oldToken);
  assert.equal((await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: oldToken }) })).status, 400, 'old link dead');
  assert.equal((await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: newToken }) })).status, 200, 'new link works');
  assert.equal(await prisma.emailVerificationToken.count({ where: { userId: user.id, usedAt: null } }), 0, 'bounded live tokens');
});

test('resend never reveals whether an arbitrary email exists', async () => {
  await registerAccount('enum');
  const existing = await json('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: `s6.enum.${RND}@test.luxora` }) });
  const nonexistent = await json('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: `s6.ghost.${RND}@test.luxora` }) });
  assert.equal(existing.status, nonexistent.status);
  assert.deepEqual(existing.body, nonexistent.body, 'identical response for existing and unknown addresses');
  assert.equal(await prisma.emailVerificationToken.count({ where: { user: { email: `s6.ghost.${RND}@test.luxora` } } }), 0);
});

test('deactivated accounts: no resend, verification fails, reset cannot reactivate', async () => {
  const { user, email } = await registerAccount('deact');
  await prisma.user.update({ where: { id: user.id }, data: { active: false } });

  const resend = await json('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
  assert.equal(resend.status, 200, 'same generic response');
  assert.equal(await prisma.emailVerificationToken.count({ where: { userId: user.id } }), 1, 'no new token for a deactivated account');

  const token = tokenFromLastEmail(); // the original registration token
  assert.equal((await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })).status, 400, 'deactivated account cannot verify');
  assert.equal(await prisma.emailVerificationToken.findFirst({ where: { userId: user.id, tokenHash: sha256(token) } }).then((r) => r.usedAt), null, 'token claim rolled back');

  // Reset still refuses a deactivated account (V1 behavior preserved).
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(`deact-reset-${RND}`), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  const reset = await json('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: `deact-reset-${RND}`, password: 'Passw0rd456' }),
  });
  assert.equal(reset.status, 400, 'deactivation-aware reset preserved');
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(fresh.active, false, 'reset never reactivates');
});

test('password reset on an active account also settles the verification flag', async () => {
  const { user, email } = await registerAccount('reset');
  await json('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) });
  const resetEmail = capturedEmails.filter((e) => e.subject === 'Reset your Luxora password').pop();
  const resetToken = decodeURIComponent(resetEmail.html.match(/reset_token=([^"<\s]+)/)[1]);
  const res = await json('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: resetToken, password: 'Passw0rd789' }),
  });
  assert.equal(res.status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).emailVerified, true, 'reset proves inbox control');
});

test('Google sign-in marks accounts verified without weakening its trust checks', async () => {
  // New Google account: created already verified (Google enforced email_verified).
  googleTokenInfo = {
    aud: process.env.GOOGLE_CLIENT_ID,
    email_verified: 'true',
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: `s6.google.${RND}@test.luxora`,
    name: 'S6 Google User',
  };
  const fresh = await json('/auth/google', { method: 'POST', body: JSON.stringify({ credential: 'credential' }) });
  assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
  assert.equal(fresh.body.user.emailVerified, true);

  // Existing unverified password account proving inbox control via Google.
  const { user, email } = await registerAccount('google-link');
  googleTokenInfo = {
    aud: process.env.GOOGLE_CLIENT_ID,
    email_verified: 'true',
    exp: Math.floor(Date.now() / 1000) + 3600,
    email,
    name: 'S6 Google Link',
  };
  const linked = await json('/auth/google', { method: 'POST', body: JSON.stringify({ credential: 'credential' }) });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.user.emailVerified, true);
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).emailVerified, true);

  // Unverified-by-Google credentials are still refused (existing hardening).
  googleTokenInfo = { aud: process.env.GOOGLE_CLIENT_ID, email_verified: 'false', exp: Math.floor(Date.now() / 1000) + 3600, email: `s6.nogoogle.${RND}@test.luxora`, name: 'Nope' };
  const refused = await json('/auth/google', { method: 'POST', body: JSON.stringify({ credential: 'credential' }) });
  assert.equal(refused.status, 401);
});

test('verification attempts are rate limited (brute-force resistance)', async () => {
  let saw429 = false;
  for (let attempt = 0; attempt < 30 && !saw429; attempt += 1) {
    const res = await json('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: `brute-${RND}-${attempt}` }) });
    if (res.status === 429) saw429 = true;
    else assert.equal(res.status, 400);
  }
  assert.equal(saw429, true, 'attempt limiter engages');
});

test('resend is rate limited (abuse resistance)', async () => {
  let saw429 = false;
  for (let attempt = 0; attempt < 10 && !saw429; attempt += 1) {
    const res = await json('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: `s6.resendlimit.${RND}@test.luxora` }) });
    if (res.status === 429) saw429 = true;
    else assert.equal(res.status, 200);
  }
  assert.equal(saw429, true, 'resend limiter engages');
});

test('admin accounts and role assignment are untouched by verification state', async () => {
  // Verification state never bypasses authorization: an emailVerified flag on
  // its own grants nothing — the session JWT and role checks are unchanged.
  assert.equal(adminUser.emailVerified, false, 'seeded admins are unaffected');
  const me = await json('/auth/me', { headers: { Authorization: `Bearer ${tokenFor(adminUser)}` } });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.role, 'ADMIN');
});
