import { spawnSync } from 'node:child_process';
import { selectTests, testSuites } from './suites.js';
import { isolatedTestUrls } from './helpers/test-database.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendDir, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to prepare the isolated test schema.');
  process.exit(1);
}

const isolatedUrls = isolatedTestUrls(process.env.DATABASE_URL);
const databaseUrl = new URL(isolatedUrls.DATABASE_URL);
const testSeedPassword = crypto.randomBytes(32).toString('base64url');

const testEnv = {
  ...process.env,
  ...isolatedUrls,
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-ci-runs-1234567890',
  NODE_ENV: 'test',
  TZ: 'Asia/Colombo',
  RESEND_API_KEY: '',
  PAYOUT_SCHEDULER_ENABLED: 'false',
  CUSTOMER_PASSWORD: testSeedPassword,
  PROVIDER_PASSWORD: testSeedPassword,
  ADMIN_PASSWORD: testSeedPassword,
};
const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');


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
  const selected = selectTests(requested);
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

// Validate coverage before any destructive setup.
const testsToRun = selectedTests();

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
  ...testsToRun,
]);
process.exit(0);
