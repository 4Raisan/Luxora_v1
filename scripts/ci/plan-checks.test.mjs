import test from 'node:test';
import assert from 'node:assert/strict';
import { allTests, testSuites, selectTests } from '../../backend/tests/suites.js';
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

test('realtime claim lifecycle test file selects bookings suite', () => {
  const plan = classifyChanges(['backend/tests/realtime-claim-lifecycle.test.js']);
  assert.deepEqual(Array.from(plan.backendSuites), ['bookings']);
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

test('payment source changes select full backend coverage', () => {
  const plan = classifyChanges(['backend/src/services/paymentContracts.js']);
  assert.equal(plan.backend, true);
  assert.equal(plan.docker, true);
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('mixed changes combine their required checks', () => {
  const plan = classifyChanges([
    'frontend/src/services/api.js',
    'backend/src/routes/bookings.js',
  ]);
  assert.equal(plan.frontend, true);
  assert.equal(plan.backend, true);
  assert.deepEqual(plan.backendSuites, ['full']);
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
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('Knowledge Graph changes select quality verification', () => {
  const plan = classifyChanges(['Knowladge-Graph/knowledge-graph.json']);
  assert.equal(plan.quality, true);
  assert.equal(plan.knowledgeGraph, true);
});

test('backend source changes select full backend and Docker without frontend', () => {
  const plan = classifyChanges(['backend/src/routes/reviews.js']);
  assert.equal(plan.quality, true);
  assert.equal(plan.backend, true);
  assert.equal(plan.knowledgeGraph, true);
  assert.equal(plan.frontend, false);
  assert.equal(plan.docker, true);
  assert.equal(plan.audit, false);
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('Docker-only changes select docker smoke without frontend or backend tests', () => {
  const plan = classifyChanges(['Dockerfile']);
  assert.equal(plan.docker, true);
  assert.equal(plan.backend, false);
  assert.equal(plan.frontend, false);
  assert.equal(plan.quality, false);
  assert.equal(plan.audit, false);
});

test('root dependency changes select full CI and dependency audit', () => {
  const plan = classifyChanges(['package-lock.json']);
  assert.equal(plan.full, true);
  assert.equal(plan.audit, true);
  assert.equal(plan.backend, true);
  assert.equal(plan.frontend, true);
  assert.equal(plan.docker, true);
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('frontend dependency changes select frontend validation, audit, and KG without backend or docker', () => {
  const plan = classifyChanges(['frontend/package.json']);
  assert.equal(plan.frontend, true);
  assert.equal(plan.quality, true);
  assert.equal(plan.knowledgeGraph, true);
  assert.equal(plan.audit, true);
  assert.equal(plan.backend, false);
  assert.equal(plan.docker, false);
});

test('backend dependency changes select backend full, audit, docker, and KG without frontend', () => {
  const plan = classifyChanges(['backend/package-lock.json']);
  assert.equal(plan.backend, true);
  assert.equal(plan.docker, true);
  assert.equal(plan.audit, true);
  assert.equal(plan.knowledgeGraph, true);
  assert.equal(plan.frontend, false);
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('mixed frontend and dependency changes select frontend build, audit, and KG', () => {
  const plan = classifyChanges([
    'frontend/src/App.jsx',
    'frontend/package.json',
  ]);
  assert.equal(plan.frontend, true);
  assert.equal(plan.quality, true);
  assert.equal(plan.knowledgeGraph, true);
  assert.equal(plan.audit, true);
  assert.equal(plan.backend, false);
  assert.equal(plan.docker, false);
});

test('mixed backend and database schema changes select full backend, database, docker, and KG', () => {
  const plan = classifyChanges([
    'backend/src/routes/bookings.js',
    'backend/prisma/schema.prisma',
  ]);
  assert.equal(plan.backend, true);
  assert.equal(plan.database, true);
  assert.equal(plan.docker, true);
  assert.equal(plan.knowledgeGraph, true);
  assert.equal(plan.frontend, false);
  assert.deepEqual(plan.backendSuites, ['full']);
});

test('multiple commits in one push combine all touched domains', () => {
  const plan = classifyChanges([
    { status: 'M', path: 'frontend/src/components/Navbar.jsx' },
    { status: 'M', path: 'backend/src/routes/services.js' },
    { status: 'M', path: 'docs/API.md' },
  ]);
  assert.equal(plan.frontend, true);
  assert.equal(plan.backend, true);
  assert.equal(plan.quality, true);
  assert.equal(plan.knowledgeGraph, true);
  assert.equal(plan.docker, true);
  assert.equal(plan.audit, false);
});



test('every existing changed test runs in its selected suite', () => {
  for (const file of allTests) {
    const plan = classifyChanges([{ status: 'M', path: `backend/${file}` }]);
    assert.ok(plan.backendSuites.flatMap(name => testSuites[name]).includes(file), file);
  }
});

test('unmapped modified tests fail closed to full discovery', () => {
  assert.deepEqual(classifyChanges(['backend/tests/future.test.js']).backendSuites, ['full']);
});

test('cross-domain and structural backend changes select full coverage', () => {
  for (const file of ['routes/services.js', 'routes/admin.js', 'routes/provider.js',
    'routes/support.js', 'routes/bookings.js', 'services/scheduling.js',
    'services/realtime.js', 'services/unknown.js', 'chatbot/data/catalog.json']) {
    for (const status of ['M', 'A', 'D', 'R100-old', 'R100-new']) {
      const plan = classifyChanges([{ path: `backend/src/${file}`, status }]);
      assert.deepEqual(plan.backendSuites, ['full'], `${file}: ${status}`);
    }
  }
});


test('runner fails rather than silently dropping missing or empty selections', () => {
  assert.throws(() => selectTests([]));
  assert.throws(() => selectTests(['unknown']));
  testSuites.testMissing = ['tests/missing.test.js'];
  try { assert.throws(() => selectTests(['testMissing']), /missing/); }
  finally { delete testSuites.testMissing; }
  assert.deepEqual(selectTests(['full']), allTests);
});
