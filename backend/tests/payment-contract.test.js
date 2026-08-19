import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPayHereWebhook, verifyPayPalCapture } from '../src/services/paymentContracts.js';

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
  assert.equal(classifyPayHereWebhook({ ...payHerePayment, gateway: 'PAYPAL' }, payHereSuccess), 'missing');
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

test('PayPal capture must be completed and match server-held amount and currency', () => {
  const payment = { expectedAmount: 12.5, expectedCurrency: 'USD' };
  const validCapture = { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ status: 'COMPLETED', amount: { value: '12.50', currency_code: 'USD' } }] } }] };
  const wrongAmount = { ...validCapture, purchase_units: [{ payments: { captures: [{ status: 'COMPLETED', amount: { value: '12.49', currency_code: 'USD' } }] } }] };
  const pendingCapture = { ...validCapture, status: 'APPROVED' };
  assert.equal(verifyPayPalCapture(payment, validCapture).valid, true);
  assert.equal(verifyPayPalCapture(payment, wrongAmount).valid, false);
  assert.equal(verifyPayPalCapture(payment, pendingCapture).valid, false);
});
