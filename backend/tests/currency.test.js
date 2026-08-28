import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLiveLkrToUsdRate, convertLkrToUsd } from '../src/services/currency.js';

test('Currency: getLiveLkrToUsdRate returns a realistic live or cached USD/LKR exchange rate', async () => {
  const { rate, timestamp, source } = await getLiveLkrToUsdRate();
  assert.equal(typeof rate, 'number');
  assert.ok(rate > 100 && rate < 1000, `Rate ${rate} is outside expected USD/LKR bounds`);
  assert.ok(timestamp);
  assert.ok(source);
});

test('Currency: convertLkrToUsd accurately converts LKR amounts to USD with 2 decimal precision', async () => {
  const result = await convertLkrToUsd(15000);
  assert.equal(result.originalAmount, 15000);
  assert.equal(result.originalCurrency, 'LKR');
  assert.equal(result.convertedCurrency, 'USD');
  assert.equal(typeof result.convertedAmount, 'number');
  assert.ok(result.convertedAmount > 10 && result.convertedAmount < 150);
  assert.equal(result.convertedAmount, Number((15000 / result.exchangeRate).toFixed(2)));
});

test('Currency: convertLkrToUsd rejects negative or invalid amounts', async () => {
  await assert.rejects(async () => convertLkrToUsd(-500), /Invalid LKR amount/);
  await assert.rejects(async () => convertLkrToUsd(0), /Invalid LKR amount/);
  await assert.rejects(async () => convertLkrToUsd('invalid'), /Invalid LKR amount/);
});
