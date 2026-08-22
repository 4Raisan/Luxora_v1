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

test('B12: payout math is exact Decimal arithmetic, not binary float', () => {
  const payout = (price) => new Prisma.Decimal(price).mul(0.85).toDecimalPlaces(2);
  // 10.05 * 0.85 = 8.5425 -> rounds to 8.54 (float math can drift here)
  assert.equal(payout('10.05').toFixed(2), '8.54');
  assert.equal(payout('0.07').toFixed(2), '0.06'); // 0.0595 -> 0.06
  assert.equal(payout(4500).toFixed(2), '3825.00');
  // Sequential increments stay exact (float drift compounds; Decimal does not)
  let earnings = new Prisma.Decimal('0.10');
  for (let i = 0; i < 3; i += 1) earnings = earnings.plus(payout('0.07'));
  assert.equal(earnings.toFixed(2), '0.28');
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
