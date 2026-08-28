import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  normalizePhoneNumber,
  sendSmsVerificationCode,
  verifySmsCode,
} from '../src/services/integrations.js';
import { prisma } from '../src/config/prisma.js';

test('TextBee: phone normalization correctly formats Sri Lankan and international numbers', () => {
  assert.equal(normalizePhoneNumber('0771234567'), '+94771234567');
  assert.equal(normalizePhoneNumber('771234567'), '+94771234567');
  assert.equal(normalizePhoneNumber('94771234567'), '+94771234567');
  assert.equal(normalizePhoneNumber('+94771234567'), '+94771234567');
  assert.equal(normalizePhoneNumber('+94 77 123 4567'), '+94771234567');
  assert.equal(normalizePhoneNumber('+14155552671'), '+14155552671');
  assert.equal(normalizePhoneNumber('invalid'), null);
  assert.equal(normalizePhoneNumber(''), null);
  assert.equal(normalizePhoneNumber(null), null);
});

test('TextBee SMS OTP Lifecycle: generate, rate limit, verify, wrong code, and replay protection', async () => {
  const testPhone = `+9477${Math.floor(1000000 + Math.random() * 9000000)}`;

  // Clean any previous test challenge
  await prisma.phoneOtpChallenge.deleteMany({ where: { phone: testPhone } });

  // 1. Send OTP
  const sendResult = await sendSmsVerificationCode(testPhone, { skipSend: true });
  assert.equal(sendResult.success, true);
  assert.equal(sendResult.phone, testPhone);

  const challenge = await prisma.phoneOtpChallenge.findUnique({ where: { phone: testPhone } });
  assert.ok(challenge, 'Challenge record should exist in database');
  assert.ok(challenge.codeHash, 'OTP code hash should be present');
  assert.equal(challenge.attempts, 0);

  // 2. Rate limit test: immediate second request should be rejected
  await assert.rejects(
    async () => sendSmsVerificationCode(testPhone),
    /Please wait \d+ seconds before requesting another code/
  );

  // 3. Wrong OTP attempt
  await assert.rejects(
    async () => verifySmsCode(testPhone, '000000'),
    /Invalid verification code/
  );

  const afterFail = await prisma.phoneOtpChallenge.findUnique({ where: { phone: testPhone } });
  assert.equal(afterFail.attempts, 1, 'Attempts counter should be incremented');

  // 4. Overwrite code for deterministic test verification
  const testCode = '839201';
  const newHash = await bcrypt.hash(testCode, 10);
  await prisma.phoneOtpChallenge.update({
    where: { phone: testPhone },
    data: { codeHash: newHash },
  });

  // 5. Successful verification
  const verifyResult = await verifySmsCode(testPhone, testCode);
  assert.equal(verifyResult.verified, true);
  assert.equal(verifyResult.phone, testPhone);

  // 6. Replay protection: challenge should be deleted and cannot be reused
  const afterSuccess = await prisma.phoneOtpChallenge.findUnique({ where: { phone: testPhone } });
  assert.equal(afterSuccess, null, 'Challenge should be deleted after successful verification');

  await assert.rejects(
    async () => verifySmsCode(testPhone, testCode),
    /No pending verification found/
  );
});

test('TextBee SMS OTP: expired challenge is rejected and cleaned up', async () => {
  const testPhone = `+9477${Math.floor(1000000 + Math.random() * 9000000)}`;
  const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
  const testCode = '112233';
  const codeHash = await bcrypt.hash(testCode, 10);

  await prisma.phoneOtpChallenge.upsert({
    where: { phone: testPhone },
    update: { codeHash, expiresAt: pastDate, attempts: 0 },
    create: { phone: testPhone, codeHash, expiresAt: pastDate, attempts: 0 },
  });

  await assert.rejects(
    async () => verifySmsCode(testPhone, testCode),
    /Verification code has expired/
  );

  const cleaned = await prisma.phoneOtpChallenge.findUnique({ where: { phone: testPhone } });
  assert.equal(cleaned, null, 'Expired challenge should be deleted');
});

test('TextBee SMS OTP: lockout after 5 failed attempts', async () => {
  const testPhone = `+9477${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testCode = '654321';
  const codeHash = await bcrypt.hash(testCode, 10);

  await prisma.phoneOtpChallenge.upsert({
    where: { phone: testPhone },
    update: { codeHash, expiresAt: new Date(Date.now() + 5 * 60 * 1000), attempts: 5 },
    create: { phone: testPhone, codeHash, expiresAt: new Date(Date.now() + 5 * 60 * 1000), attempts: 5 },
  });

  await assert.rejects(
    async () => verifySmsCode(testPhone, '000000'),
    /Too many failed verification attempts/
  );

  const cleaned = await prisma.phoneOtpChallenge.findUnique({ where: { phone: testPhone } });
  assert.equal(cleaned, null, 'Exceeded attempts challenge should be removed');
});
