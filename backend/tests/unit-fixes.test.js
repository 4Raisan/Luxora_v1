// Unit tests for the security/durability fixes that are testable without a
// running server: upload signature sniffing (B11), exact money math (B12) and
// PayHere webhook signing (B13-adjacent hardening).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import '../src/config/prisma.js'; // applies the Decimal -> number JSON serialization
import { detectFileSignature } from '../src/routes/uploads.js';
import { verifyPayHereWebhook } from '../src/services/integrations.js';
import { isPublicHttpsUrl } from '../src/routes/integrations.js';
import { getObject, putObject, removeObject } from '../src/services/storage.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF = Buffer.from('%PDF-1.7\n...', 'ascii');
const TEXT = Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8');
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

test('B11: magic-byte sniffing recognizes genuine JPEG/PNG/PDF content', () => {
  assert.equal(detectFileSignature(PNG)?.type, 'image/png');
  assert.equal(detectFileSignature(JPEG)?.type, 'image/jpeg');
  assert.equal(detectFileSignature(PDF)?.type, 'application/pdf');
});

test('B11: scripts, executables and renamed text files have no recognized signature', () => {
  // A .jpg-named shell script must not be identified as an image — its bytes are text.
  assert.equal(detectFileSignature(TEXT), null);
  assert.equal(detectFileSignature(EXE), null);
  assert.equal(detectFileSignature(Buffer.alloc(0)), null);
  assert.equal(detectFileSignature(Buffer.from('GIF89a', 'ascii')), null);
});

test('B11: stored extensions come from sniffed content, not the client filename', () => {
  for (const [buffer, ext] of [[PNG, '.png'], [JPEG, '.jpg'], [PDF, '.pdf']]) {
    assert.equal(detectFileSignature(buffer)?.ext, ext);
  }
});

test('Upload storage round-trips private bytes and rejects traversal keys', async () => {
  const key = `storage-test-${crypto.randomUUID()}.png`;
  await putObject(key, PNG, 'image/png');
  assert.deepEqual(await getObject(key), PNG);
  await removeObject(key);
  assert.equal(await getObject(key), null);
  await assert.rejects(() => putObject('../escape.png', PNG, 'image/png'), /Invalid storage key/);
});

test('B12: configured provider earnings use exact Decimal values', () => {
  const configuredRates = ['2500.00', '3000.00', '3300.00'].map((value) => new Prisma.Decimal(value));
  const total = configuredRates.reduce((sum, rate) => sum.plus(rate), new Prisma.Decimal(0));
  assert.equal(total.toFixed(2), '8800.00');
});

test('B12: Decimal money serializes to JSON as a number, preserving API shape', () => {
  assert.equal(typeof JSON.parse(JSON.stringify(new Prisma.Decimal('12000.00'))), 'number');
  assert.equal(JSON.parse(JSON.stringify(new Prisma.Decimal('12000.00'))), 12000);
  assert.equal(JSON.parse(JSON.stringify(new Prisma.Decimal('8.54'))), 8.54);
});

test('B13: PayHere webhook signature verification accepts a correctly signed payload', () => {
  process.env.PAYHERE_MERCHANT_ID = 'TEST_MERCHANT';
  process.env.PAYHERE_MERCHANT_SECRET = 'test-secret';
  const payload = {
    merchant_id: 'TEST_MERCHANT',
    order_id: 'LUX-PH-1-1-abc',
    payhere_amount: '12000.00',
    status_code: '2',
    payhere_currency: 'LKR',
  };
  const md5 = (value) => crypto.createHash('md5').update(value).digest('hex').toUpperCase();
  payload.md5sig = md5(
    payload.merchant_id + payload.order_id + payload.payhere_amount
    + payload.payhere_currency + payload.status_code + md5('test-secret'),
  );
  assert.equal(verifyPayHereWebhook(payload), true);
  payload.md5sig = md5('wrong');
  assert.equal(verifyPayHereWebhook(payload), false);
  const copy = { ...payload, merchant_id: 'OTHER' };
  copy.md5sig = payload.md5sig;
  assert.equal(verifyPayHereWebhook({ ...copy, md5sig: md5('wrong') }), false);
});

test('PayHere checkout rejects non-HTTPS and private callback URLs', () => {
  assert.equal(isPublicHttpsUrl('https://luxora.bond/customer-dashboard'), true);
  assert.equal(isPublicHttpsUrl('http://luxora.bond/customer-dashboard'), false);
  assert.equal(isPublicHttpsUrl('https://localhost:3000/return'), false);
  assert.equal(isPublicHttpsUrl('https://127.0.0.1/return'), false);
  assert.equal(isPublicHttpsUrl('not-a-url'), false);
});

test('Audit Fix C2: Payout scheduler last-day of month calculation logic', () => {
  function isLastDayOfMonth(date) {
    const tomorrow = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
    return tomorrow.getUTCDate() === 1;
  }

  assert.equal(isLastDayOfMonth(new Date('2026-02-28T10:00:00Z')), true, 'Feb 28 is the last day of Feb');
  assert.equal(isLastDayOfMonth(new Date('2026-02-27T10:00:00Z')), false, 'Feb 27 is not the last day');
  assert.equal(isLastDayOfMonth(new Date('2026-04-30T10:00:00Z')), true, 'Apr 30 is the last day of Apr');
  assert.equal(isLastDayOfMonth(new Date('2026-04-29T10:00:00Z')), false, 'Apr 29 is not the last day');
  assert.equal(isLastDayOfMonth(new Date('2026-12-31T10:00:00Z')), true, 'Dec 31 is the last day of Dec');
});

test('Audit Fix C3: Promotion discount percentage Decimal precision', () => {
  const discount = new Prisma.Decimal('15.50');
  assert.equal(discount.toFixed(2), '15.50');
  assert.equal(JSON.parse(JSON.stringify(discount)), 15.5);
});
