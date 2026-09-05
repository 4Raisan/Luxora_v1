import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePassword } from '../src/middleware/validators.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Production seed refuses to create demo accounts', () => {
  const env = { ...process.env, NODE_ENV: 'production', SEED_DEMO_ACCOUNTS: 'true' };
  delete env.CUSTOMER_PASSWORD;
  delete env.PROVIDER_PASSWORD;
  delete env.ADMIN_PASSWORD;
  const result = spawnSync(process.execPath, ['prisma/seed.js'], { cwd: backendDir, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /Production seeding cannot create demo accounts/);
});

test('The compromised public password is rejected for new and reset passwords', () => {
  assert.equal(validatePassword(['luxora', '123'].join('')).valid, false);
});
