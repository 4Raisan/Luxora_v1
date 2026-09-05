import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedTestUrls } from './helpers/test-database.js';

test('migrations and queries share the local isolated URL despite inherited DIRECT_URL', () => {
  const inherited = { DATABASE_URL: 'postgresql://tester:local@localhost:5432/test_db?schema=public',
    DIRECT_URL: 'postgresql://example.invalid/staging' };
  const env = { ...inherited, ...isolatedTestUrls(inherited.DATABASE_URL) };
  assert.equal(env.DATABASE_URL, env.DIRECT_URL);
  const url = new URL(env.DIRECT_URL);
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.pathname, '/test_db');
  assert.equal(url.searchParams.get('schema'), 'luxora_test');
});

test('reject non-local, non-Postgres, and invalid URLs before any database action', () => {
  for (const value of ['postgresql://example.invalid/db', 'https://localhost/db', '',
    'postgresql://localhost.example.invalid/db']) assert.throws(() => isolatedTestUrls(value));
  assert.equal(new URL(isolatedTestUrls('postgresql://127.0.0.1/db').DIRECT_URL).hostname, '127.0.0.1');
});
