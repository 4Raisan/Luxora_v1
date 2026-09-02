import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyChanges } from './plan-checks.mjs';

test('documentation-only changes stay minimal', () => {
  const plan = classifyChanges([
    'README.md',
    'docs/api.md',
    'backend/README.md',
    'frontend/README.md',
  ]);
  assert.equal(plan.docsOnly, true);
  assert.equal(plan.backend, false);
  assert.equal(plan.frontend, false);
  assert.equal(plan.docker, false);
});

test('new or deleted unclassified backend source files fail closed to full backend coverage', () => {
  for (const status of ['A', 'D']) {
    const plan = classifyChanges([{ status, path: 'backend/src/services/ledger.js' }]);
    assert.equal(plan.full, false);
    assert.equal(plan.backend, true);
    assert.equal(plan.docker, true);
    assert.deepEqual(plan.backendSuites, ['full']);
  }
});

test('new backend test files select the full backend suite', () => {
  const plan = classifyChanges([{ status: 'A', path: 'backend/tests/ledger.test.js' }]);
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('frontend changes select frontend validation', () => {
  const plan = classifyChanges(['frontend/src/pages/Login.jsx']);
  assert.equal(plan.quality, true);
  assert.equal(plan.frontend, true);
  assert.equal(plan.backend, false);
});

test('Prisma changes select full backend, database, and Docker checks', () => {
  const plan = classifyChanges(['backend/prisma/schema.prisma']);
  assert.equal(plan.backend, true);
  assert.equal(plan.database, true);
  assert.equal(plan.docker, true);
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('payment changes select payment and security suites', () => {
  const plan = classifyChanges(['backend/src/services/paymentContracts.js']);
  assert.equal(plan.backend, true);
  assert.equal(plan.docker, true);
  assert.deepEqual(new Set(plan.backendSuites), new Set(['payments', 'security']));
});

test('mixed changes combine their required checks', () => {
  const plan = classifyChanges([
    'frontend/src/services/api.js',
    'backend/src/routes/bookings.js',
  ]);
  assert.equal(plan.frontend, true);
  assert.equal(plan.backend, true);
  assert.deepEqual(plan.backendSuites, ['bookings']);
});

test('workflow and classifier changes fail closed to full CI', () => {
  for (const file of ['.github/workflows/ci.yml', 'scripts/ci/plan-checks.mjs']) {
    const plan = classifyChanges([file]);
    assert.equal(plan.full, true);
    assert.equal(plan.frontend, true);
    assert.equal(plan.backend, true);
    assert.equal(plan.docker, true);
    assert.deepEqual(plan.backendSuites, ['full']);
  }
});

test('unknown source areas fail closed to full CI', () => {
  const plan = classifyChanges(['worker/src/payout-worker.js']);
  assert.equal(plan.full, true);
  assert.match(plan.reasons.join(' '), /not classified/);
});

test('large refactors select full CI', () => {
  const files = Array.from({ length: 31 }, (_, index) => 'frontend/src/components/C' + index + '.jsx');
  const plan = classifyChanges(files);
  assert.equal(plan.full, true);
});

test('large documentation updates stay documentation-only', () => {
  const files = Array.from({ length: 40 }, (_, index) => 'docs/page-' + index + '.md');
  const plan = classifyChanges(files);
  assert.equal(plan.full, false);
  assert.equal(plan.docsOnly, true);
});

test('old and new paths of renames are both safety-relevant', () => {
  const plan = classifyChanges([
    { status: 'R100-old', path: 'backend/src/middleware/auth.js' },
    { status: 'R100-new', path: 'docs/old-auth.md' },
  ]);
  assert.equal(plan.backend, true);
  assert.equal(plan.docker, true);
  assert.ok(plan.backendSuites.includes('security'));
});

test('Knowledge Graph changes select quality verification', () => {
  const plan = classifyChanges(['Knowladge-Graph/knowledge-graph.json']);
  assert.equal(plan.quality, true);
  assert.equal(plan.knowledgeGraph, true);
});
