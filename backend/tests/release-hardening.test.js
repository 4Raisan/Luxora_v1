import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();
import { prisma } from '../src/config/prisma.js';
import { stopChildProcess } from './helpers/stop-child-process.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import { getEntitlementSnapshot } from '../src/services/entitlements.js';
import {
  encryptAccountNumber,
  decryptAccountNumber,
  maskAccountNumber,
  reencryptAccountNumber,
  assertBankingKeyConfigured,
  getBankKey,
} from '../src/services/bankingCrypto.js';
import { migrateBankAccounts } from '../prisma/migrate-bank-accounts.js';
import { assertStorageConfigured, objectStorageEnabled } from '../src/services/storage.js';
import { escapeHtml } from '../src/services/integrations.js';
import { isOriginAllowed } from '../src/index.js';
import { activateSubscription } from '../src/services/paymentFulfilment.js';
import { renewDueDemoSubscriptions } from '../src/routes/services.js';
import { validatePassword, isPassword } from '../src/middleware/validators.js';
import { resolveApiBase } from '../../frontend/src/services/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

const PORT = 5039;
const BASE = `http://127.0.0.1:${PORT}/api`;

const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  PAYMENT_MODE: 'demo',
  RESEND_API_KEY: '',
  GOOGLE_CLIENT_ID: '',
  CORS_ORIGIN: 'https://luxora.bond,https://admin.luxora.bond',
};

let server;
const json = async (path, options = {}) => {
  const response = await fetch(`${BASE}${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, headers: response.headers, body, text };
};

const authJson = (token, path, options = {}) => json(path, {
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  },
});

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
});

after(async () => {
  await stopChildProcess(server);
  try { await prisma.$disconnect(); } catch {}
});

test('Release Hardening 1: Immutable subscription entitlements snapshot on creation', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const cust = await prisma.user.create({
    data: { name: `Immut Cust ${rnd}`, email: `immut.cust.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Colombo', addressDistrict: 'Western' },
  });
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = jwt.sign({ id: adminUser.id, role: 'ADMIN', tokenVersion: adminUser.tokenVersion }, JWT_SECRET);

  const gardenCat = await prisma.category.findUnique({ where: { name: 'Garden Care' } });
  assert.ok(gardenCat);

  // Admin creates a new plan with 2 units of Garden Care at 15000 LKR
  const createPlanRes = await authJson(adminToken, '/admin/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      title: `Lawn Tier A ${rnd}`,
      type: 'Garden Care',
      price_monthly: 15000,
      duration_days: 30,
      features: ['Lawn mowing', 'Weed control'],
      entitlements: [{ category_id: gardenCat.id, units: 2 }],
      recommended: false,
    }),
  });
  assert.equal(createPlanRes.status, 201);
  const planId = createPlanRes.body.id;

  // Customer purchases/activates this subscription
  await prisma.userSubscription.create({
    data: {
      userId: cust.id,
      planId: planId,
      planTitle: `Lawn Tier A ${rnd}`,
      planType: 'Garden Care',
      pricePaid: 15000,
      currency: 'LKR',
      durationDays: 30,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400000),
      status: 'active',
      entitlements: {
        create: [{ categoryId: gardenCat.id, units: 2 }],
      },
    },
  });

  // Verify initial entitlement snapshot reflects 2 units, LKR currency, and 15000 price
  const initialSnapshot = await getEntitlementSnapshot(prisma, cust.id);
  const gardenEntry1 = initialSnapshot.find((e) => e.category_id === gardenCat.id);
  assert.equal(gardenEntry1.entitled_units, 2);
  assert.equal(gardenEntry1.subscriptions[0].plan_title, `Lawn Tier A ${rnd}`);
  assert.equal(Number(gardenEntry1.subscriptions[0].price_monthly), 15000);
  assert.equal(gardenEntry1.subscriptions[0].currency, 'LKR');

  // Admin modifies the plan: increases units to 5 and price to 25000
  const updatePlanRes = await authJson(adminToken, `/admin/subscriptions/${planId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: `Lawn Tier A Revised ${rnd}`,
      price_monthly: 25000,
      entitlements: [{ category_id: gardenCat.id, units: 5 }],
    }),
  });
  assert.equal(updatePlanRes.status, 200);

  // Customer's purchased subscription entitlement snapshot MUST remain immutable (2 units, original title and price)
  const afterUpdateSnapshot = await getEntitlementSnapshot(prisma, cust.id);
  const gardenEntry2 = afterUpdateSnapshot.find((e) => e.category_id === gardenCat.id);
  assert.equal(gardenEntry2.entitled_units, 2, 'Active subscription units must NOT change when admin edits future plan');
  assert.equal(gardenEntry2.subscriptions[0].plan_title, `Lawn Tier A ${rnd}`);
  assert.equal(Number(gardenEntry2.subscriptions[0].price_monthly), 15000);
  assert.equal(gardenEntry2.subscriptions[0].currency, 'LKR');
});

test('Release Hardening 2: Banking encryption at rest & masking in APIs', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const provUser = await prisma.user.create({
    data: { name: `Bank Prov ${rnd}`, email: `bank.prov.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Galle', addressDistrict: 'Southern', active: true },
  });
  const prov = await prisma.provider.create({
    data: { userId: provUser.id, category: 'Auto Care', serviceTowns: 'Galle', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const provToken = jwt.sign({ id: provUser.id, role: 'PROVIDER', tokenVersion: 0 }, JWT_SECRET);

  const rawAccountNumber = '800123456789012';

  // Provider adds bank account
  const addRes = await authJson(provToken, '/provider/bank-accounts', {
    method: 'POST',
    body: JSON.stringify({
      bank_name: 'Commercial Bank of Ceylon',
      account_holder: 'A. B. Perera',
      account_number: rawAccountNumber,
      branch: 'Galle Fort',
    }),
  });
  assert.equal(addRes.status, 201);
  assert.equal(addRes.body.account_number, '••••••••9012', 'API response must mask account number');

  // Inspect raw record directly in database table
  const dbRecord = await prisma.providerBankAccount.findFirst({
    where: { providerId: prov.id },
  });
  assert.ok(dbRecord);
  assert.ok(dbRecord.accountNumber.startsWith('enc:v1:'), 'Account number must be encrypted at rest with enc:v1 prefix');
  assert.notEqual(dbRecord.accountNumber, rawAccountNumber, 'Plaintext account number must NOT be stored');

  // Decryption recovers exact original plaintext
  const decrypted = decryptAccountNumber(dbRecord.accountNumber);
  assert.equal(decrypted, rawAccountNumber);
  assert.equal(maskAccountNumber(dbRecord.accountNumber), '••••••••9012');
});

test('Release Hardening 3: Provider has one editable payout bank account', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const provUser = await prisma.user.create({
    data: { name: `Conc Bank ${rnd}`, email: `conc.bank.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Kandy', addressDistrict: 'Central', active: true },
  });
  const prov = await prisma.provider.create({
    data: { userId: provUser.id, category: 'Garden Care', serviceTowns: 'Kandy', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });
  const provToken = jwt.sign({ id: provUser.id, role: 'PROVIDER', tokenVersion: 0 }, JWT_SECRET);

  // The first save creates the account; the second save edits the same row.
  const acc1Res = await authJson(provToken, '/provider/bank-accounts', {
    method: 'POST',
    body: JSON.stringify({ bank_name: 'Bank of Ceylon', account_holder: 'Holder 1', account_number: '1111222233334444', branch: 'Kandy' }),
  });
  const acc2Res = await authJson(provToken, '/provider/bank-accounts', {
    method: 'POST',
    body: JSON.stringify({ bank_name: 'Sampath Bank', account_holder: 'Holder 2', account_number: '5555666677778888', branch: 'Peradeniya' }),
  });
  assert.equal(acc1Res.status, 201);
  assert.equal(acc2Res.status, 200);
  assert.equal(acc2Res.body.id, acc1Res.body.id);
  assert.equal(await prisma.providerBankAccount.count({ where: { providerId: prov.id } }), 1);
  const account = await prisma.providerBankAccount.findFirst({ where: { providerId: prov.id } });
  assert.equal(account.bankName, 'Sampath Bank');
  assert.equal(account.accountHolder, 'Holder 2');
  assert.equal(account.branch, 'Peradeniya');
  assert.equal(account.selected, true);
});

test('Provider redemption reserves balance and admin settlement updates the ledger', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const providerUser = await prisma.user.create({
    data: { name: `Redeem Provider ${rnd}`, email: `redeem.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', active: true },
  });
  const provider = await prisma.provider.create({
    data: { userId: providerUser.id, category: 'Auto Care', kycStatus: 'APPROVED', earnings: 6500 },
  });
  const providerToken = jwt.sign({ id: providerUser.id, role: 'PROVIDER', tokenVersion: 0 }, JWT_SECRET);
  const accountNumber = '123456789012';
  const bankResponse = await authJson(providerToken, '/provider/bank-accounts', {
    method: 'POST',
    body: JSON.stringify({ bank_name: 'Bank of Ceylon', account_holder: providerUser.name, account_number: accountNumber, branch: 'Colombo Fort' }),
  });
  assert.equal(bankResponse.status, 201);

  const belowMinimum = await authJson(providerToken, '/provider/payouts/redeem', { method: 'POST', body: JSON.stringify({ amount: 4999.99 }) });
  assert.equal(belowMinimum.status, 400);
  const request = await authJson(providerToken, '/provider/payouts/redeem', { method: 'POST', body: JSON.stringify({ amount: 5000 }) });
  assert.equal(request.status, 201);
  const reservedProvider = await prisma.provider.findUnique({ where: { id: provider.id } });
  assert.equal(Number(reservedProvider.earnings), 1500);

  const payout = await prisma.providerPayout.findUnique({ where: { id: request.body.id } });
  assert.equal(payout.kind, 'REDEMPTION');
  assert.equal(payout.status, 'PENDING');
  assert.ok(payout.accountNumberSnapshot.startsWith('enc:v1:'));

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true } });
  const adminToken = jwt.sign({ id: admin.id, role: 'ADMIN', tokenVersion: admin.tokenVersion }, JWT_SECRET);
  const adminRows = await authJson(adminToken, '/admin/payouts');
  const adminRow = adminRows.body.find((row) => row.id === payout.id);
  assert.equal(adminRow.account_number, accountNumber);
  assert.equal(adminRow.branch, 'Colombo Fort');

  const realtimeAbort = new AbortController();
  const realtimeResponse = await fetch(`${BASE}/realtime?token=${encodeURIComponent(providerToken)}`, { signal: realtimeAbort.signal });
  assert.equal(realtimeResponse.status, 200);
  const realtimeReader = realtimeResponse.body.getReader();
  const decoder = new TextDecoder();
  const connectedChunk = await realtimeReader.read();
  assert.match(decoder.decode(connectedChunk.value), /event: connected/);

  let payoutEventTimeout;
  const payoutEventPromise = Promise.race([
    (async () => {
      let output = '';
      while (!output.includes('event: PAYOUT_UPDATED')) {
        const chunk = await realtimeReader.read();
        if (chunk.done) break;
        output += decoder.decode(chunk.value, { stream: true });
      }
      return output;
    })(),
    new Promise((_, reject) => { payoutEventTimeout = setTimeout(() => reject(new Error('Timed out waiting for PAYOUT_UPDATED')), 5000); }),
  ]);
  const settled = await authJson(adminToken, `/admin/payouts/${payout.id}`, { method: 'PUT', body: JSON.stringify({ status: 'paid' }) });
  const realtimeOutput = await payoutEventPromise;
  clearTimeout(payoutEventTimeout);
  realtimeAbort.abort();
  assert.equal(settled.status, 200);
  assert.match(realtimeOutput, /event: PAYOUT_UPDATED/);
  assert.match(realtimeOutput, /"status":"paid"/);
  assert.match(realtimeOutput, /"redeemed":5000/);
  const providerSummary = await authJson(providerToken, '/provider/earnings');
  assert.equal(Number(providerSummary.body.redeemed), 5000);
  assert.equal(Number(providerSummary.body.balance), 1500);
  assert.ok(await prisma.notification.findFirst({ where: { userId: providerUser.id, message: { contains: `#${payout.id}` } } }));
});

test('Release Hardening 4: Production upload durability and banking key assertions', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalKey = process.env.BANK_ENCRYPTION_KEY;
  try {
    process.env.NODE_ENV = 'production';
    if (!objectStorageEnabled) {
      assert.throws(
        () => assertStorageConfigured(),
        /FATAL: S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be configured in production/,
        'Must throw in production when S3 credentials are missing'
      );
    }
    delete process.env.BANK_ENCRYPTION_KEY;
    assert.throws(
      () => assertBankingKeyConfigured(),
      /FATAL: BANK_ENCRYPTION_KEY must be configured in production/,
      'Must throw in production when BANK_ENCRYPTION_KEY is missing'
    );
    assert.throws(
      () => getBankKey(),
      /FATAL: BANK_ENCRYPTION_KEY is required in production environment/,
      'Must refuse fallback key derivation in production'
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalKey) process.env.BANK_ENCRYPTION_KEY = originalKey;
  }
});

test('Release Hardening 5: Banking key rotation and re-encryption', () => {
  const rawAccount = '1234567890123456';
  const keyA = 'key_alpha_secret_32_bytes_test_1';
  const keyB = 'key_bravo_secret_32_bytes_test_2';

  const encryptedA = encryptAccountNumber(rawAccount, keyA);
  assert.ok(encryptedA.startsWith('enc:v1:'));
  assert.equal(decryptAccountNumber(encryptedA, keyA), rawAccount);

  // Decrypting with wrong key must fail
  assert.throws(() => decryptAccountNumber(encryptedA, keyB));

  // Re-encrypt from Key A to Key B
  const encryptedB = reencryptAccountNumber(encryptedA, keyA, keyB);
  assert.ok(encryptedB.startsWith('enc:v1:'));
  assert.equal(decryptAccountNumber(encryptedB, keyB), rawAccount);
  assert.equal(maskAccountNumber(encryptedB, keyB), '••••••••3456');
});

test('Release Hardening 6: Plaintext legacy bank account migration and normalization', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const provUser = await prisma.user.create({
    data: { name: `Legacy Prov ${rnd}`, email: `legacy.prov.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'PROVIDER', town: 'Jaffna', addressDistrict: 'Northern', active: true },
  });
  const prov = await prisma.provider.create({
    data: { userId: provUser.id, category: 'Garden Care', serviceTowns: 'Jaffna', kycStatus: 'APPROVED', availabilityStatus: 'available' },
  });

  // Seed raw unencrypted legacy bank accounts directly into DB
  const rawNum1 = '9000111122223333';
  const rawNum2 = '9000444455556666';

  const acc1 = await prisma.providerBankAccount.create({
    data: {
      providerId: prov.id,
      bankName: 'Bank One',
      accountHolder: 'Legacy Holder 1',
      accountNumber: rawNum1, // Raw unencrypted
      selected: false,
      updatedAt: new Date(Date.now() - 60000),
    },
  });

  const acc2 = await prisma.providerBankAccount.create({
    data: {
      providerId: prov.id,
      bankName: 'Bank Two',
      accountHolder: 'Legacy Holder 2',
      accountNumber: rawNum2, // Raw unencrypted
      selected: false,
      updatedAt: new Date(),
    },
  });

  // Run the safe migration script in dry-run first
  const dryResult = await migrateBankAccounts(prisma, { dryRun: true });
  assert.equal(dryResult.dryRun, true);
  assert.ok(dryResult.verified >= 2);

  // Run the safe migration script
  const result = await migrateBankAccounts(prisma);
  assert.ok(result.migrated >= 2);
  assert.ok(result.verified >= 2);

  // Verify accounts are encrypted and mask/hash populated
  const updated1 = await prisma.providerBankAccount.findUnique({ where: { id: acc1.id } });
  const updated2 = await prisma.providerBankAccount.findUnique({ where: { id: acc2.id } });

  assert.ok(updated1.accountNumber.startsWith('enc:v1:'));
  assert.ok(updated2.accountNumber.startsWith('enc:v1:'));
  assert.equal(decryptAccountNumber(updated1.accountNumber), rawNum1);
  assert.equal(decryptAccountNumber(updated2.accountNumber), rawNum2);
  assert.equal(updated1.accountMask, '••••••••3333');
  assert.equal(updated2.accountMask, '••••••••6666');
  assert.ok(updated1.accountHash);
  assert.ok(updated2.accountHash);

  // Normalization must select the latest updated account (acc2) when none were selected
  assert.equal(updated1.selected, false, 'Older account remains unselected');
  assert.equal(updated2.selected, true, 'Latest updated account must be selected');
});

test('Release Hardening 7: NOWPayments USD settlement snapshots contractual LKR price on subscription', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const cust = await prisma.user.create({
    data: { name: `USD Cust ${rnd}`, email: `usd.cust.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Colombo', addressDistrict: 'Western' },
  });
  const plan = await prisma.subscriptionPlan.findFirst({ where: { type: 'Auto Care' }, include: { entitlements: true } });
  assert.ok(plan);

  const lkrContractPrice = Number(plan.priceMonthly);
  const usdSettledAmount = 48.50; // Settled in USD via crypto

  const payment = await prisma.payment.create({
    data: {
      userId: cust.id,
      planId: plan.id,
      gateway: 'NOWPAYMENTS',
      gatewayOrderId: `ORDER-NOWP-${rnd}`,
      idempotencyKey: `IDEM-NOWP-${rnd}`,
      status: 'PENDING',
      expectedAmount: lkrContractPrice,
      expectedCurrency: 'LKR',
    },
  });

  // Gateway settles payment in USD
  const updatedPayment = await activateSubscription(payment, { payment_id: `NP-PAY-${rnd}` }, {
    capturedAmount: usdSettledAmount,
    capturedCurrency: 'USD',
  });

  assert.ok(updatedPayment);
  assert.equal(updatedPayment.status, 'COMPLETED');
  assert.equal(Number(updatedPayment.capturedAmount), usdSettledAmount, 'Payment captures settled USD amount');
  assert.equal(updatedPayment.capturedCurrency, 'USD');

  // Verify UserSubscription stores the contractual LKR price and currency
  const sub = await prisma.userSubscription.findUnique({
    where: { id: updatedPayment.subscriptionId },
  });
  assert.ok(sub);
  assert.equal(Number(sub.pricePaid), lkrContractPrice, 'Subscription must retain contractual LKR plan price');
  assert.equal(sub.currency, 'LKR', 'Subscription contractual currency must be LKR');
});

test('Release Hardening 8: Later admin plan price change does not alter subscription renewals or entitlement values', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const cust = await prisma.user.create({
    data: { name: `Renew Cust ${rnd}`, email: `renew.cust.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('pass123', 10), role: 'CUSTOMER', town: 'Colombo', addressDistrict: 'Western' },
  });
  const gardenCat = await prisma.category.findUnique({ where: { name: 'Garden Care' } });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Grand Garden ${rnd}`,
      type: 'Garden Care',
      priceMonthly: 12000,
      durationDays: 30,
      features: JSON.stringify(['Pruning', 'Lawn care']),
      entitlements: {
        create: [{ categoryId: gardenCat.id, units: 3 }],
      },
    },
    include: { entitlements: true },
  });

  // User purchases subscription with autoRenew enabled
  const demoSub = await prisma.userSubscription.create({
    data: {
      userId: cust.id,
      planId: plan.id,
      planTitle: `Grand Garden ${rnd}`,
      planType: 'Garden Care',
      pricePaid: 12000,
      currency: 'LKR',
      durationDays: 30,
      startDate: new Date(Date.now() - 31 * 86400000),
      endDate: new Date(Date.now() - 1000),
      status: 'active',
      autoRenew: true,
      renewalIntervalDays: 30,
      nextRenewalDate: new Date(Date.now() - 1000),
      entitlements: {
        create: [{ categoryId: gardenCat.id, units: 3 }],
      },
    },
    include: { entitlements: true },
  });

  // Admin later increases plan price to 20000 and decreases units to 1
  await prisma.subscriptionPlan.update({
    where: { id: plan.id },
    data: {
      priceMonthly: 20000,
      entitlements: {
        deleteMany: {},
        create: [{ categoryId: gardenCat.id, units: 1 }],
      },
    },
  });

  // The subscription originated in the Demo Payment gateway — attach its
  // DEMO payment so the demo renewal system owns this renewal.
  await prisma.payment.create({
    data: {
      userId: cust.id,
      planId: plan.id,
      subscriptionId: demoSub.id,
      gateway: 'DEMO',
      gatewayOrderId: `LUX-DEMO-RH8-${rnd}`,
      idempotencyKey: `IDEM-RH8-${rnd}`,
      status: 'COMPLETED',
      expectedAmount: 12000,
      expectedCurrency: 'LKR',
      capturedAmount: 12000,
      capturedCurrency: 'LKR',
    },
  });

  // Run demo renewal — no PAYMENT_MODE needed: the DEMO gateway origin
  // decides which subscriptions the demo renewal system covers.
  const renewed = await renewDueDemoSubscriptions();
  assert.ok(renewed.length >= 1);

    // Verify the newly renewed subscription uses the snapshotted price (12000) and units (3), not the new plan values
    const renewedSub = await prisma.userSubscription.findFirst({
      where: { userId: cust.id, status: 'active' },
      include: { entitlements: true, payments: true },
    });
    assert.ok(renewedSub);
    assert.equal(Number(renewedSub.pricePaid), 12000, 'Renewed subscription price must be from snapshot (12000), not mutable plan (20000)');
    assert.equal(renewedSub.currency, 'LKR');
    assert.equal(renewedSub.entitlements.length, 1);
    assert.equal(renewedSub.entitlements[0].units, 3, 'Renewed units must be 3 from snapshot, not 1');
});

test('Release Hardening 9: CORS allowed origins in production and development', () => {
  const originalCors = process.env.CORS_ORIGIN;
  try {
    process.env.CORS_ORIGIN = 'https://luxora.bond,https://admin.luxora.bond';

    // In production: only configured origins allowed
    assert.equal(isOriginAllowed('https://luxora.bond', true), true);
    assert.equal(isOriginAllowed('https://admin.luxora.bond', true), true);
    assert.equal(isOriginAllowed('https://evil-attacker.com', true), false);
    assert.equal(isOriginAllowed('http://localhost:3000', true), false);
    assert.equal(isOriginAllowed('*', true), false);

    // In development: localhost origins permitted
    assert.equal(isOriginAllowed('http://localhost:5173', false), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:3000', false), true);
    assert.equal(isOriginAllowed('https://evil-attacker.com', false), false);
  } finally {
    process.env.CORS_ORIGIN = originalCors;
  }
});

test('Release Hardening 10: HTML email escaping utility', () => {
  const maliciousInput = '<script>alert("XSS")</script>&"\'<img src=x onerror=alert(1)>';
  const escaped = escapeHtml(maliciousInput);
  assert.ok(!escaped.includes('<script>'), 'Must escape <script>');
  assert.ok(!escaped.includes('<img'), 'Must escape <img>');
  assert.ok(escaped.includes('&lt;script&gt;'));
  assert.ok(escaped.includes('&amp;'));
  assert.ok(escaped.includes('&quot;'));
  assert.ok(escaped.includes('&#39;'));
});

test('Release Hardening 11: HTTP Security Headers and CSP verification', async () => {
  const res = await json('/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('x-xss-protection'), '1; mode=block');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.ok(res.headers.get('content-security-policy')?.includes("default-src 'self'"), 'CSP header must be present');
});

test('Release Hardening 12: Promotion discount applies to subscription pricePaid and renewal preserves paid price', async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  const cust = await prisma.user.create({
    data: { name: `Promo Cust ${rnd}`, email: `promo.cust.${rnd}@test.luxora`, passwordHash: await bcrypt.hash('ValidPass123!', 10), role: 'CUSTOMER', town: 'Colombo', addressDistrict: 'Western' },
  });
  let autoCat = await prisma.category.findFirst({ where: { name: 'Auto Care' } });
  if (!autoCat) {
    autoCat = await prisma.category.create({
      data: { name: 'Auto Care', description: 'Auto Care Services' },
    });
  }

  const plan = await prisma.subscriptionPlan.create({
    data: {
      title: `Promo Auto ${rnd}`,
      type: 'Auto Care',
      priceMonthly: 15000,
      durationDays: 30,
      features: JSON.stringify(['Interior', 'Exterior']),
      entitlements: {
        create: [{ categoryId: autoCat.id, units: 2 }],
      },
    },
    include: { entitlements: true },
  });

  // Payment record with 20% discount (paid 12,000 instead of 15,000)
  const payment = await prisma.payment.create({
    data: {
      userId: cust.id,
      planId: plan.id,
      gateway: 'DEMO',
      gatewayOrderId: `DEMO-PROMO-${rnd}`,
      idempotencyKey: `IDEM-PROMO-${rnd}`,
      status: 'PENDING',
      originalAmount: 15000,
      discountAmount: 3000,
      expectedAmount: 12000,
      expectedCurrency: 'LKR',
    },
  });

  const completedPayment = await activateSubscription(payment, { mode: 'demo' });
  assert.ok(completedPayment);

  const sub = await prisma.userSubscription.findUnique({
    where: { id: completedPayment.subscriptionId },
  });
  assert.ok(sub);
  assert.equal(Number(sub.pricePaid), 12000, 'Subscription pricePaid must store the discounted amount paid (12000), not pre-discount price (15000)');
});

test('Release Hardening 13: Strengthened password policy and common password blacklist', () => {
  // Too short (< 8 chars)
  assert.equal(validatePassword('short').valid, false);
  assert.equal(validatePassword('pass12').valid, false);

  // Common passwords
  assert.equal(validatePassword('password123').valid, false);
  assert.equal(validatePassword('12345678').valid, false);
  assert.equal(validatePassword('admin123').valid, false);

  // Missing digits or missing letters
  assert.equal(validatePassword('abcdefghijk').valid, false);
  assert.equal(validatePassword('9876543210').valid, false);

  // Repeated single character
  assert.equal(validatePassword('aaaaaaaa').valid, false);

  // Valid passwords
  assert.equal(validatePassword('StrongPass123!').valid, true);
  assert.equal(validatePassword('LuxoraSecurity2026').valid, true);
  assert.equal(isPassword('StrongPass123!'), true);
});

test('Release Hardening 14: Frontend API URL dynamic resolution', () => {
  // In production mode without VITE_API_URL -> same-origin relative /api
  assert.equal(resolveApiBase(undefined, true), '/api');
  assert.equal(resolveApiBase('', true), '/api');

  // In production mode with custom domain
  assert.equal(resolveApiBase('https://luxora.bond/api', true), 'https://luxora.bond/api');
  assert.equal(resolveApiBase('https://luxora.bond', true), 'https://luxora.bond/api');

  // In development mode -> local Express backend
  assert.equal(resolveApiBase(undefined, false), 'http://localhost:5000/api');
});
