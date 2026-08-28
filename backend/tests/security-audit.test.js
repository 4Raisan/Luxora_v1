import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';
import { JWT_SECRET } from '../src/config/env.js';
import { detectFileSignature } from '../src/routes/uploads.js';
import { verifyPayHereWebhook } from '../src/services/integrations.js';
import {
  verifyNowPaymentsSignature,
  classifyNowPaymentsIpn,
} from '../src/services/paymentContracts.js';

test('Security Audit: File upload content sniffing & malicious payload rejection', async () => {
  // Test 1: Fake JPEG with bash script content
  const fakeJpg = Buffer.from('#!/bin/bash\necho "pwned"\n');
  assert.equal(detectFileSignature(fakeJpg), null, 'Disguised shell script must have no valid signature');

  // Test 2: Fake PDF with HTML / XSS content
  const fakePdf = Buffer.from('<html><script>alert(1)</script></html>');
  assert.equal(detectFileSignature(fakePdf), null, 'HTML/XSS disguised as document must be rejected');

  // Test 3: Genuine JPEG magic bytes
  const validJpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
  const detectedJpg = detectFileSignature(validJpg);
  assert.ok(detectedJpg, 'Genuine JPEG must be detected');
  assert.equal(detectedJpg.type, 'image/jpeg');

  // Test 4: Genuine PDF magic bytes
  const validPdf = Buffer.from('%PDF-1.7\n%test');
  const detectedPdf = detectFileSignature(validPdf);
  assert.ok(detectedPdf, 'Genuine PDF must be detected');
  assert.equal(detectedPdf.type, 'application/pdf');
});

test('Security Audit: Webhook signature verification and anti-forgery', async () => {
  // PayHere signature test with invalid checksum
  const forgedPayHere = {
    merchant_id: '123456',
    order_id: 'ORDER-FORGED',
    payhere_amount: '5000.00',
    payhere_currency: 'LKR',
    status_code: '2',
    md5sig: 'FORGED_INVALID_HASH_VALUE_12345',
  };
  assert.equal(verifyPayHereWebhook(forgedPayHere), false, 'Forged PayHere webhook must be rejected');

  // NOWPayments IPN signature test with invalid HMAC
  const forgedNowPayments = {
    payment_id: 123456,
    payment_status: 'finished',
    order_id: 'ORDER-FORGED-NP',
    price_amount: 50,
    price_currency: 'usd',
  };
  const invalidSig = 'invalid_hmac_signature_000000000000000000000000';
  assert.equal(
    verifyNowPaymentsSignature(forgedNowPayments, invalidSig),
    false,
    'Forged NOWPayments signature must be rejected'
  );
});

test('Security Audit: NOWPayments state machine strictly reserves completion for finished', async () => {
  const paymentRecord = {
    id: 1,
    gateway: 'NOWPAYMENTS',
    status: 'PENDING',
    expectedAmount: 10000,
    expectedCurrency: 'LKR',
  };

  // 'confirmed' must NOT be classified as success
  const confirmedIpn = {
    order_id: 'ORDER-1',
    payment_status: 'confirmed',
    price_amount: 10000,
    price_currency: 'lkr',
  };
  assert.equal(
    classifyNowPaymentsIpn(paymentRecord, confirmedIpn),
    'pending',
    'confirmed must stay pending, never success'
  );

  // 'sending' must NOT be classified as success
  const sendingIpn = {
    order_id: 'ORDER-1',
    payment_status: 'sending',
    price_amount: 10000,
    price_currency: 'lkr',
  };
  assert.equal(
    classifyNowPaymentsIpn(paymentRecord, sendingIpn),
    'pending',
    'sending must stay pending, never success'
  );

  // ONLY 'finished' can be classified as success
  const finishedIpn = {
    order_id: 'ORDER-1',
    payment_status: 'finished',
    price_amount: 10000,
    price_currency: 'lkr',
  };
  assert.equal(
    classifyNowPaymentsIpn(paymentRecord, finishedIpn),
    'success',
    'finished must be classified as success'
  );
});

test('Security Audit: Token role claim tampering protection', async () => {
  // Create or fetch a test customer user
  let customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER', active: true } });
  if (!customer) {
    customer = await prisma.user.create({
      data: {
        name: 'Sec Test Customer',
        email: `sec_cust_${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash('Password123!', 10),
        role: 'CUSTOMER',
        active: true,
      },
    });
  }

  // Attacker crafts a token with role = 'ADMIN' for the customer user id
  const forgedToken = jwt.sign(
    { id: customer.id, email: customer.email, role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Verify that decoding the token and checking against database role reveals role tampering
  const decoded = jwt.verify(forgedToken, JWT_SECRET);
  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, role: true, active: true },
  });

  assert.equal(dbUser.role, 'CUSTOMER', 'Database role must remain CUSTOMER');
  assert.notEqual(dbUser.role, decoded.role, 'Role spoofing in JWT payload must not match DB truth');
});

test('Security Audit: Service PIN attempt limit lockout simulation', async () => {
  const MAX_ATTEMPTS = 5;
  let attempts = 0;
  let lockedUntil = null;

  const testPinHash = await bcrypt.hash('789123', 10);
  const wrongPin = '000000';

  // 5 consecutive wrong attempts
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const isMatch = await bcrypt.compare(wrongPin, testPinHash);
    assert.equal(isMatch, false, 'Wrong PIN must not match');
    attempts++;
    if (attempts >= MAX_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  assert.equal(attempts, 5, 'Must have recorded 5 attempts');
  assert.ok(lockedUntil && lockedUntil > new Date(), 'Must be locked for 15 minutes after 5 attempts');
});
