import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendDir, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to prepare the isolated test schema.');
  process.exit(1);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname)) {
  console.error('Refusing to run destructive test setup against a non-local PostgreSQL host.');
  process.exit(1);
}
databaseUrl.searchParams.set('schema', 'luxora_test');

const testEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  DIRECT_URL: process.env.DIRECT_URL || databaseUrl.toString(),
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-ci-runs-1234567890',
  NODE_ENV: 'test',
  RESEND_API_KEY: '',
  PAYOUT_SCHEDULER_ENABLED: 'false',
};
const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');

const orderedTests = [
  'tests/fresh-db-smoke.test.js',
  'tests/security-audit.test.js',
  'tests/currency.test.js',
  'tests/nowpayments.test.js',
  'tests/nowpayments-e2e.test.js',
  'tests/payment-contract.test.js',
  'tests/unit-fixes.test.js',
  'tests/api-fixes.test.js',
  'tests/booking-concurrency.test.js',
  'tests/booking-lifecycle-timeouts.test.js',
  'tests/new-flow-rules.test.js',
  'tests/realtime-claim-lifecycle.test.js',
  'tests/release-hardening.test.js',
];
const discoveredTests = fs.readdirSync(path.join(backendDir, 'tests'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
  .map((entry) => 'tests/' + entry.name)
  .sort();
const allTests = [
  ...orderedTests.filter((file) => fs.existsSync(path.join(backendDir, file))),
  ...discoveredTests.filter((file) => !orderedTests.includes(file)),
];

const testSuites = {
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
    'tests/release-hardening.test.js',
  ],
  bookings: [
    'tests/fresh-db-smoke.test.js',
    'tests/service-photo-flow.test.js',
    'tests/api-fixes.test.js',
    'tests/booking-concurrency.test.js',
    'tests/booking-lifecycle-timeouts.test.js',
    'tests/new-flow-rules.test.js',
    'tests/realtime-claim-lifecycle.test.js',
  ],
  security: [
    'tests/security-audit.test.js',
    'tests/release-hardening.test.js',
  ],
  full: allTests,
};

function selectedTests() {
  const suiteArg = process.argv.find((arg) => arg.startsWith('--suite='));
  const requested = (suiteArg?.slice('--suite='.length) || 'full')
    .split(',')
    .map((suite) => suite.trim())
    .filter(Boolean);
  const unknown = requested.filter((suite) => !testSuites[suite]);
  if (unknown.length > 0) {
    console.error('Unknown test suite(s): ' + unknown.join(', '));
    console.error('Available suites: ' + Object.keys(testSuites).join(', '));
    process.exit(1);
  }
  const wanted = new Set(requested.flatMap((suite) => testSuites[suite]));
  const selected = allTests.filter((file) => wanted.has(file));
  console.log(
    'Running backend test suite(s): '
      + requested.join(', ')
      + ' ('
      + selected.length
      + ' files)',
  );
  return selected;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: backendDir, env: testEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

import { PrismaClient } from '@prisma/client';

const resetPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });
try {
  await resetPrisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS luxora_test CASCADE;');
  await resetPrisma.$executeRawUnsafe('CREATE SCHEMA luxora_test;');
} finally {
  await resetPrisma.$disconnect();
}

run(process.execPath, [prismaCli, 'migrate', 'deploy']);
run(process.execPath, ['prisma/seed.js']);
run(process.execPath, [
  '--test',
  '--test-force-exit',
  '--test-concurrency=1',
  '--test-timeout=120000',
  ...selectedTests(),
]);
process.exit(0);
