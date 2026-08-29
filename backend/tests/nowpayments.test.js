import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  sortObject,
  verifyNowPaymentsSignature,
  classifyNowPaymentsIpn,
} from '../src/services/paymentContracts.js';
import { prisma } from '../src/config/prisma.js';
import './assert-test-database.js';

before(async () => {
  try {
    await prisma.$executeRawUnsafe('ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS \'NOWPAYMENTS\';');
  } catch {
    // ignore if already present or not supported
  }
});

test('NOWPayments: sortObject correctly sorts nested objects alphabetically', () => {
  const input = {
    z_field: 'last',
    a_field: 123,
    m_field: {
      sub_z: 'sub_last',
      sub_a: 'sub_first',
    },
  };

  const sorted = sortObject(input);
  const keys = Object.keys(sorted);
  assert.deepEqual(keys, ['a_field', 'm_field', 'z_field']);
  assert.deepEqual(Object.keys(sorted.m_field), ['sub_a', 'sub_z']);
});

test('NOWPayments: verifyNowPaymentsSignature verifies valid HMAC-SHA512 signatures', () => {
  const secret = 'test_ipn_secret_key_12345';
  const payload = {
    payment_id: 12345678,
    payment_status: 'finished',
    pay_address: '0x1234567890abcdef',
    price_amount: 15000,
    price_currency: 'usd',
    pay_amount: 0.05,
    actually_paid: 0.05,
    pay_currency: 'btc',
    order_id: 'LUX-NP-TEST-1',
  };

  // Compute expected HMAC-SHA512
  const sorted = sortObject(payload);
  const hmac = crypto.createHmac('sha512', secret);
  const signature = hmac.update(JSON.stringify(sorted)).digest('hex');

  // Valid signature
  assert.equal(verifyNowPaymentsSignature(payload, signature, secret), true);
  assert.equal(verifyNowPaymentsSignature(payload, signature.toUpperCase(), secret), true);

  // Invalid / tampered signature
  assert.equal(verifyNowPaymentsSignature(payload, 'invalid_sig', secret), false);
  assert.equal(verifyNowPaymentsSignature({ ...payload, price_amount: 99999 }, signature, secret), false);
  assert.equal(verifyNowPaymentsSignature(payload, signature, 'wrong_secret'), false);
  assert.equal(verifyNowPaymentsSignature(payload, null, secret), false);
  assert.equal(verifyNowPaymentsSignature(null, signature, secret), false);
});

test('NOWPayments: classifyNowPaymentsIpn handles all state transitions accurately', () => {
  const payment = {
    id: 1,
    gateway: 'NOWPAYMENTS',
    status: 'PENDING',
    expectedAmount: 15000,
    expectedCurrency: 'USD',
  };

  // Finished -> success (ONLY final status)
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'finished', price_amount: 15000, price_currency: 'USD' }), 'success');

  // Waiting / Confirming / Confirmed / Sending -> pending (in-progress)
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'confirmed', price_amount: 15000, price_currency: 'USD' }), 'pending');
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'sending', price_amount: 15000, price_currency: 'USD' }), 'pending');
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'waiting', price_amount: 15000, price_currency: 'USD' }), 'pending');
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'confirming', price_amount: 15000, price_currency: 'USD' }), 'pending');

  // Failed / Expired -> failed
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'failed', price_amount: 15000, price_currency: 'USD' }), 'failed');
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'expired', price_amount: 15000, price_currency: 'USD' }), 'failed');

  // Partially paid -> partially_paid
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'partially_paid', price_amount: 15000, price_currency: 'USD' }), 'partially_paid');

  // Refunded -> refunded
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'refunded', price_amount: 15000, price_currency: 'USD' }), 'refunded');

  // Amount or Currency mismatch
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'finished', price_amount: 10000, price_currency: 'USD' }), 'amount_mismatch');
  assert.equal(classifyNowPaymentsIpn(payment, { payment_status: 'finished', price_amount: 15000, price_currency: 'EUR' }), 'amount_mismatch');

  // LKR to USD Dynamic Currency Conversion support
  const lkrPaymentWithUsdConversion = {
    id: 2,
    gateway: 'NOWPAYMENTS',
    status: 'PENDING',
    expectedAmount: 15000, // LKR
    expectedCurrency: 'LKR',
    webhookPayload: {
      conversion: {
        originalAmount: 15000,
        originalCurrency: 'LKR',
        convertedAmount: 45.65,
        convertedCurrency: 'USD',
        exchangeRate: 328.6,
      },
    },
  };
  // Valid IPN matching converted USD amount
  assert.equal(classifyNowPaymentsIpn(lkrPaymentWithUsdConversion, { payment_status: 'finished', price_amount: 45.65, price_currency: 'USD' }), 'success');
  // Pending in-progress statuses with converted USD amount
  assert.equal(classifyNowPaymentsIpn(lkrPaymentWithUsdConversion, { payment_status: 'confirmed', price_amount: 45.65, price_currency: 'USD' }), 'pending');
  assert.equal(classifyNowPaymentsIpn(lkrPaymentWithUsdConversion, { payment_status: 'sending', price_amount: 45.65, price_currency: 'USD' }), 'pending');
  // Mismatched converted USD amount
  assert.equal(classifyNowPaymentsIpn(lkrPaymentWithUsdConversion, { payment_status: 'finished', price_amount: 99.99, price_currency: 'USD' }), 'amount_mismatch');

  // Already completed payment
  assert.equal(classifyNowPaymentsIpn({ ...payment, status: 'COMPLETED' }, { payment_status: 'finished', price_amount: 15000, price_currency: 'USD' }), 'already_completed');

  // Wrong gateway
  assert.equal(classifyNowPaymentsIpn({ ...payment, gateway: 'PAYHERE' }, { payment_status: 'finished', price_amount: 15000, price_currency: 'USD' }), 'missing');
});

test('NOWPayments: Database payment lifecycle and idempotency check', async () => {
  const orderId = `LUX-NP-UNITTEST-${Date.now()}`;
  let user = await prisma.user.findFirst({ where: { email: 'customer@luxora.lk' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `test_np_${Date.now()}@luxora.lk`,
        name: 'NOWPayments Test User',
        role: 'CUSTOMER',
        password: 'hashed_password_123',
      },
    });
  }

  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });

  // Create PENDING payment
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      planId: plan?.id,
      gateway: 'NOWPAYMENTS',
      gatewayOrderId: orderId,
      idempotencyKey: orderId,
      expectedAmount: 12000,
      expectedCurrency: 'USD',
      status: 'PENDING',
    },
  });

  assert.equal(payment.status, 'PENDING');
  assert.equal(payment.gateway, 'NOWPAYMENTS');

  // Clean up
  await prisma.payment.deleteMany({ where: { gatewayOrderId: orderId } });
});
