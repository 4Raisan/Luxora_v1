// V2 Slice 4 — tests for the customer refund UI helpers
// (frontend/src/utils/refunds.js). These cover the presentation logic the
// customer dashboard relies on: status wording, terminal vs open badge
// tones, customer-safe row mapping, and amount-input parsing. Network,
// authorization, and state-machine behavior stay covered by the backend
// refund suites (refund-api.test.js, refund-admin.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REFUND_STATUS_LABELS,
  isOpenRefundStatus,
  mapCustomerRefundRow,
  mapCustomerRefundRows,
  parseRefundAmountInput,
  refundCanShowCancel,
  refundStatusLabel,
  refundStatusTone,
} from '../src/utils/refunds.js';

test('every backend refund status has customer-friendly wording', () => {
  assert.equal(refundStatusLabel('REQUESTED'), 'Request received');
  assert.equal(refundStatusLabel('UNDER_REVIEW'), 'Being reviewed');
  assert.equal(refundStatusLabel('APPROVED'), 'Approved');
  assert.equal(refundStatusLabel('PROCESSING'), 'Refund being processed');
  assert.equal(refundStatusLabel('COMPLETED'), 'Refund completed');
  assert.equal(refundStatusLabel('REJECTED'), 'Refund rejected');
  assert.equal(refundStatusLabel('FAILED'), 'Refund failed');
  assert.equal(refundStatusLabel('CANCELLED'), 'Cancelled');
  // Matching is case-insensitive: the API serializes lowercase statuses.
  assert.equal(refundStatusLabel('completed'), 'Refund completed');
  assert.equal(Object.keys(REFUND_STATUS_LABELS).length, 8, 'all backend states are mapped');
});

test('unknown statuses fall back to the raw value instead of crashing', () => {
  assert.equal(refundStatusLabel('SOMETHING_NEW'), 'SOMETHING_NEW');
  assert.equal(refundStatusLabel(''), '');
  assert.equal(refundStatusLabel(null), '');
});

test('open statuses are visually distinct from terminal ones', () => {
  for (const open of ['requested', 'under_review', 'approved', 'processing']) {
    assert.equal(refundStatusTone(open), 'active', `${open} stays gold/active`);
    assert.equal(isOpenRefundStatus(open), true);
  }
  assert.equal(refundStatusTone('completed'), 'completed');
  assert.equal(refundStatusTone('rejected'), 'failed');
  assert.equal(refundStatusTone('failed'), 'failed');
  assert.equal(refundStatusTone('cancelled'), 'closed');
  for (const terminal of ['completed', 'rejected', 'failed', 'cancelled']) {
    assert.equal(isOpenRefundStatus(terminal), false, `${terminal} is terminal`);
  }
});

test('cancel action is only offered while the request is open', () => {
  assert.equal(refundCanShowCancel('requested'), true);
  assert.equal(refundCanShowCancel('under_review'), true);
  assert.equal(refundCanShowCancel('approved'), false);
  assert.equal(refundCanShowCancel('processing'), false);
  assert.equal(refundCanShowCancel('completed'), false);
  assert.equal(refundCanShowCancel('cancelled'), false);
  assert.equal(refundCanShowCancel(undefined), false);
});

test('refund history rows are mapped to customer-safe display models', () => {
  const row = mapCustomerRefundRow({
    id: 7,
    payment_id: 42,
    amount: '250.50',
    currency: 'LKR',
    status: 'under_review',
    reason: 'Service was rescheduled twice',
    created_at: '2026-09-01T10:00:00.000Z',
    decided_at: '2026-09-02T09:30:00.000Z',
    completed_at: null,
    // Internal fields that must never reach the customer UI:
    admin_note: 'checked with provider',
    provider_ref: 'PAY-INTERNAL-9',
    requestedBy: 999,
  });
  assert.deepEqual(Object.keys(row).sort(), [
    'amount', 'cancellable', 'currency', 'id', 'payment', 'paymentId',
    'reason', 'requestedAt', 'status', 'updatedAt',
  ]);
  assert.equal(row.amount, 250.5);
  assert.equal(row.paymentId, 42);
  assert.equal(row.status, 'under_review');
  assert.equal(row.updatedAt, '2026-09-02T09:30:00.000Z');
  assert.equal(row.cancellable, true);
  assert.equal(JSON.stringify(row).includes('admin_note'), false, 'admin notes are dropped');
  assert.equal(JSON.stringify(row).includes('provider_ref'), false, 'provider refs are dropped');
});

test('completed refunds keep a payment reference and are not cancellable', () => {
  const row = mapCustomerRefundRow({
    id: 8,
    payment_id: 43,
    payment: { id: 43, gateway: 'PAYHERE', captured_amount: 100, captured_currency: 'LKR' },
    amount: 100,
    currency: 'LKR',
    status: 'completed',
    reason: 'Full refund please',
    created_at: '2026-09-01T10:00:00.000Z',
    decided_at: '2026-09-02T09:30:00.000Z',
    completed_at: '2026-09-03T12:00:00.000Z',
  });
  assert.deepEqual(row.payment, { id: 43, gateway: 'PAYHERE', capturedAmount: 100, capturedCurrency: 'LKR' });
  assert.equal(row.updatedAt, '2026-09-03T12:00:00.000Z', 'completion date wins as last update');
  assert.equal(row.cancellable, false);
});

test('malformed history data cannot crash the list', () => {
  assert.deepEqual(mapCustomerRefundRows(null), []);
  assert.deepEqual(mapCustomerRefundRows('nope'), []);
  assert.deepEqual(mapCustomerRefundRows([null, undefined, false]), []);
  const broken = mapCustomerRefundRow({ status: 'requested' });
  assert.equal(broken.amount, 0, 'missing amount renders as 0, not NaN');
  assert.equal(broken.currency, 'LKR', 'missing currency falls back to LKR');
  assert.equal(broken.reason, '');
});

test('refund amount input keeps decimals and rejects unusable values', () => {
  assert.equal(parseRefundAmountInput('12500.50'), 12500.5, 'decimal amounts survive');
  assert.equal(parseRefundAmountInput('LKR 1,500'), 1500, 'formatted prefill parses');
  assert.equal(parseRefundAmountInput('42'), 42);
  assert.equal(parseRefundAmountInput(90), 90);
  assert.equal(parseRefundAmountInput('0'), null, 'zero is not a refund');
  assert.equal(parseRefundAmountInput('-5'), null, 'negative input is rejected');
  assert.equal(parseRefundAmountInput('abc'), null);
  assert.equal(parseRefundAmountInput(''), null);
  assert.equal(parseRefundAmountInput(null), null);
  assert.equal(parseRefundAmountInput(undefined), null);
});
