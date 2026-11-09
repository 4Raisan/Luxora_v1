import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queueMonthlyPayouts, startMonthlyPayoutScheduler } from '../src/services/payouts.js';
import { validateRefundAmount } from '../src/services/refunds.js';

test('monthly payouts freeze the bank selected inside the transaction', async () => {
  const account = { id: 2, bankName: 'Bank B', accountHolder: 'Provider', accountNumber: 'enc:v1:encrypted', branch: 'Colombo' };
  const staleAccount = { ...account, id: 1, bankName: 'Bank A' };
  let created;
  let locked = false;
  const tx = {
    $executeRaw: async () => { locked = true; },
    provider: {
      findUniqueOrThrow: async () => {
        assert.equal(locked, true);
        return { earnings: 5000, bankAccounts: [account] };
      },
      update: async () => {},
    },
    providerPayout: {
      findUnique: async () => null,
      create: async ({ data }) => { created = data; return data; },
    },
  };
  await queueMonthlyPayouts({
    period: '2026-10',
    client: {
      provider: { findMany: async () => [{ id: 1, bankAccounts: [staleAccount] }] },
      $transaction: async (fn) => fn(tx),
    },
  });
  account.bankName = 'Edited bank';
  account.accountNumber = 'Edited number';
  assert.equal(created.bankAccountId, 2);
  assert.equal(created.bankNameSnapshot, 'Bank B');
  assert.equal(created.accountHolderSnapshot, 'Provider');
  assert.equal(created.accountNumberSnapshot, 'enc:v1:encrypted');
  assert.equal(created.branchSnapshot, 'Colombo');
});

test('monthly scheduler retries failures, prevents overlap and skips a successful day', async (t) => {
  const previous = process.env.PAYOUT_SCHEDULER_ENABLED;
  process.env.PAYOUT_SCHEDULER_ENABLED = 'true';
  t.after(() => {
    if (previous === undefined) delete process.env.PAYOUT_SCHEDULER_ENABLED;
    else process.env.PAYOUT_SCHEDULER_ENABLED = previous;
  });
  t.mock.method(console, 'error', () => {});
  let tick;
  let calls = 0;
  let finish;
  startMonthlyPayoutScheduler({
    now: () => new Date('2026-10-31T12:00:00Z'),
    schedule: (fn) => { tick = fn; return { unref() {} }; },
    queue: async ({ period }) => {
      assert.equal(period, '2026-10');
      calls++;
      if (calls === 1) throw new Error('temporary outage');
      await new Promise((resolve) => { finish = resolve; });
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  const retry = tick();
  await tick();
  assert.equal(calls, 2);
  finish();
  await retry;
  await tick();
  assert.equal(calls, 2);
});

test('refund defaults reject exhausted balances and validate currency precision', () => {
  for (const amount of [undefined, null, 0, -1, 0.001, '1.234', NaN, Infinity]) {
    assert.throws(() => validateRefundAmount(amount, 0), (error) => error.statusCode === 400);
  }
  for (const amount of [0.001, '1.234']) {
    assert.throws(() => validateRefundAmount(amount, 100), (error) => error.statusCode === 400);
  }
  assert.equal(validateRefundAmount(undefined, 0.01), 0.01);
  assert.equal(validateRefundAmount(null, 100), 100);
  assert.equal(validateRefundAmount('10.25', 100), 10.25);
  assert.equal(validateRefundAmount(0.01, 0.01), 0.01);
});
