import { spawnSync } from 'node:child_process';
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
  NODE_ENV: 'test',
  RESEND_API_KEY: '',
  PAYOUT_SCHEDULER_ENABLED: 'false',
};
const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: backendDir, env: testEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

// The exact isolated schema name is verified above before this destructive reset.
run(process.execPath, [prismaCli, 'migrate', 'reset', '--force', '--skip-seed']);
run(process.execPath, ['prisma/seed.js']);
run(process.execPath, [
  '--test',
  '--test-concurrency=1',
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
  'tests/release-hardening.test.js',
]);
process.exit(0);
