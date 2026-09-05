import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const testsDir = path.dirname(fileURLToPath(import.meta.url));

const orderedTests = [
  'tests/fresh-db-smoke.test.js',
  'tests/security-audit.test.js',
  'tests/seed-security.test.js',
  'tests/currency.test.js',
  'tests/nowpayments.test.js',
  'tests/nowpayments-e2e.test.js',
  'tests/payment-contract.test.js',
  'tests/demo-payment.test.js',
  'tests/unit-fixes.test.js',
  'tests/api-fixes.test.js',
  'tests/booking-concurrency.test.js',
  'tests/booking-lifecycle-timeouts.test.js',
  'tests/new-flow-rules.test.js',
  'tests/realtime-claim-lifecycle.test.js',
  'tests/release-hardening.test.js',
];
const discoveredTests = fs.readdirSync(testsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
  .map((entry) => 'tests/' + entry.name)
  .sort();
export const allTests = [
  ...orderedTests.filter((file) => fs.existsSync(path.join(testsDir, '..', file))),
  ...discoveredTests.filter((file) => !orderedTests.includes(file)),
];

export const testSuites = {
  smoke: [
    'tests/fresh-db-smoke.test.js',
    'tests/security-audit.test.js',
    'tests/payment-contract.test.js',
    'tests/unit-fixes.test.js',
    'tests/api-fixes.test.js',
  ],
  payments: [
    'tests/currency.test.js',
    'tests/nowpayments.test.js',
    'tests/nowpayments-e2e.test.js',
    'tests/payment-contract.test.js',
    'tests/demo-payment.test.js',
    'tests/release-hardening.test.js',
  ],
  bookings: [
    'tests/fresh-db-smoke.test.js',
    'tests/service-photo-flow.test.js',
    'tests/api-fixes.test.js',
    'tests/booking-concurrency.test.js',
    'tests/booking-lifecycle-timeouts.test.js',
    'tests/new-flow-rules.test.js',
    'tests/booking-business-rules.test.js',
    'tests/realtime-claim-lifecycle.test.js',
  ],
  security: [
    'tests/security-audit.test.js',
    'tests/seed-security.test.js',
    'tests/disable-seed-accounts.test.js',
    'tests/release-hardening.test.js',
  ],
  full: allTests,
};


export function selectTests(requested) {
  if (!requested.length) throw new Error('At least one test suite is required');
  for (const name of requested) {
    if (!Object.hasOwn(testSuites, name)) throw new Error(`Unknown test suite: ${name}`);
  }
  const wanted = new Set(requested.flatMap(name => testSuites[name]));
  for (const file of wanted) {
    if (!allTests.includes(file)) throw new Error(`Selected test is missing: ${file}`);
  }
  const selected = allTests.filter(file => wanted.has(file));
  if (!selected.length) throw new Error('Selected test suites contain no tests');
  return selected;
}
