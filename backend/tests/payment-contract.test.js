import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPayHereWebhook } from '../src/services/paymentContracts.js';

const payHerePayment = {
  gateway: 'PAYHERE',
  status: 'PENDING',
  expectedAmount: 125000,
  expectedCurrency: 'LKR',
};

const payHereSuccess = {
  order_id: 'LUX-PH-1-test',
  payhere_amount: '125000.00',
  payhere_currency: 'LKR',
  status_code: '2',
};

test('PayHere replay of a completed payment is idempotently recognized', () => {
  assert.equal(classifyPayHereWebhook({ ...payHerePayment, status: 'COMPLETED' }, payHereSuccess), 'already_completed');
});

test('PayHere webhook with no internal payment record is rejected', () => {
  assert.equal(classifyPayHereWebhook(null, payHereSuccess), 'missing');
});

test('PayHere amount or currency mismatch cannot settle', () => {
  assert.equal(classifyPayHereWebhook(payHerePayment, { ...payHereSuccess, payhere_amount: '124999.99' }), 'amount_mismatch');
  assert.equal(classifyPayHereWebhook(payHerePayment, { ...payHereSuccess, payhere_currency: 'USD' }), 'amount_mismatch');
});

test('PayHere pending, failed, refunded, and successful states are distinct', () => {
  assert.equal(classifyPayHereWebhook(payHerePayment, { ...payHereSuccess, status_code: '0' }), 'pending');
  assert.equal(classifyPayHereWebhook(payHerePayment, { ...payHereSuccess, status_code: '-2' }), 'failed');
  assert.equal(classifyPayHereWebhook(payHerePayment, { ...payHereSuccess, status_code: '-3' }), 'refunded');
  assert.equal(classifyPayHereWebhook(payHerePayment, payHereSuccess), 'success');
});
