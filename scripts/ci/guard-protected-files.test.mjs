import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isProtectedPath,
  checkProtectedFiles,
  parseNameStatus,
  collectChangedFilesFromEvent,
  AUTHORIZED_MAINTAINER,
} from './guard-protected-files.mjs';

test('isProtectedPath accurately flags protected paths', () => {
  const protectedExamples = [
    '.github/workflows/ci.yml',
    '.github/workflows/knowledge-graph-pages.yml',
    '.github/workflows/nested/custom.yml',
    '.github/CODEOWNERS',
    '.github/codeowners',
    '.github/dependabot.yml',
    '.github/dependabot.yaml',
    '.gitleaks.toml',
    'Dockerfile',
    'dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'vercel.json',
    './Dockerfile',
    '.\\.github\\workflows\\ci.yml',
  ];

  for (const path of protectedExamples) {
    assert.equal(isProtectedPath(path), true, `Expected ${path} to be protected`);
  }
});

test('isProtectedPath does not flag standard application files', () => {
  const unprotectedExamples = [
    'frontend/src/App.jsx',
    'frontend/src/pages/Login.jsx',
    'backend/src/index.js',
    'backend/src/routes/bookings.js',
    'backend/prisma/schema.prisma',
    'README.md',
    'docs/CI.md',
    'package.json',
    'package-lock.json',
    'scripts/ci/plan-checks.mjs',
    'Knowladge-Graph/knowledge-graph.json',
    '.gitignore',
  ];

  for (const path of unprotectedExamples) {
    assert.equal(isProtectedPath(path), false, `Expected ${path} to be unprotected`);
  }
});

test('normal source code commits pass for any user', () => {
  const result = checkProtectedFiles([
    'frontend/src/pages/CustomerDashboard.jsx',
    'backend/src/routes/auth.js',
    'README.md',
  ], 'contributor123');

  assert.equal(result.passed, true);
  assert.equal(result.modifiedProtectedFiles.length, 0);
  assert.equal(result.isMaintainer, false);
});

test('single protected file change fails for unauthorized user', () => {
  const result = checkProtectedFiles(['Dockerfile'], 'contributor123');

  assert.equal(result.passed, false);
  assert.deepEqual(result.modifiedProtectedFiles, ['Dockerfile']);
  assert.match(result.reason, /Unauthorized attempt to modify protected files/);
  assert.match(result.reason, /Only @4Raisan is authorized/);
});

test('multiple protected file changes fail and list all files', () => {
  const result = checkProtectedFiles([
    'frontend/src/index.css',
    'Dockerfile',
    '.github/workflows/ci.yml',
    'vercel.json',
  ], 'friend_user');

  assert.equal(result.passed, false);
  assert.deepEqual(result.modifiedProtectedFiles, [
    '.github/workflows/ci.yml',
    'Dockerfile',
    'vercel.json',
  ]);
  assert.equal(result.actor, 'friend_user');
});

test('multi-commit push with mixed files fails for unauthorized user', () => {
  const entries = [
    { status: 'M', path: 'frontend/src/App.jsx' },
    { status: 'M', path: 'backend/src/services/auth.js' },
    { status: 'M', path: 'docker-compose.yml' },
    { status: 'A', path: 'docs/guide.md' },
  ];
  const result = checkProtectedFiles(entries, 'external_collaborator');

  assert.equal(result.passed, false);
  assert.deepEqual(result.modifiedProtectedFiles, ['docker-compose.yml']);
});

test('renaming protected files fails for unauthorized user', () => {
  const entries = parseNameStatus('R100\tDockerfile\tDockerfile.backup');
  const result = checkProtectedFiles(entries, 'random_dev');

  assert.equal(result.passed, false);
  assert.ok(result.modifiedProtectedFiles.includes('Dockerfile'));
});

test('deleting protected files fails for unauthorized user', () => {
  const entries = parseNameStatus('D\t.gitleaks.toml');
  const result = checkProtectedFiles(entries, 'random_dev');

  assert.equal(result.passed, false);
  assert.deepEqual(result.modifiedProtectedFiles, ['.gitleaks.toml']);
});

test('protected file changes succeed for authorized maintainer 4Raisan', () => {
  const result = checkProtectedFiles([
    '.github/workflows/ci.yml',
    'docker-compose.yml',
    'Dockerfile',
    'vercel.json',
    '.github/CODEOWNERS',
    '.github/dependabot.yml',
    '.gitleaks.toml',
  ], '4Raisan');

  assert.equal(result.passed, true);
  assert.equal(result.isMaintainer, true);
  assert.equal(result.modifiedProtectedFiles.length, 7);
  assert.match(result.reason, /authorized maintainer @4Raisan/);
});

test('maintainer check is case-tolerant', () => {
  for (const variant of ['4raisan', '4Raisan', '4RAISAN']) {
    const result = checkProtectedFiles(['Dockerfile'], variant);
    assert.equal(result.passed, true, `Failed for variant: ${variant}`);
    assert.equal(result.isMaintainer, true);
  }
});

test('collectChangedFilesFromEvent parses GitHub webhook payload correctly', () => {
  const mockPayload = {
    commits: [
      {
        id: '111',
        added: ['frontend/src/NewComponent.jsx'],
        modified: ['backend/src/index.js'],
        removed: [],
      },
      {
        id: '222',
        added: [],
        modified: ['docker-compose.yml'],
        removed: ['old-file.txt'],
      },
    ],
    head_commit: {
      id: '222',
      added: [],
      modified: ['docker-compose.yml'],
      removed: ['old-file.txt'],
    },
  };

  const entries = collectChangedFilesFromEvent(mockPayload);
  const paths = entries.map((e) => e.path);

  assert.ok(paths.includes('frontend/src/NewComponent.jsx'));
  assert.ok(paths.includes('backend/src/index.js'));
  assert.ok(paths.includes('docker-compose.yml'));
  assert.ok(paths.includes('old-file.txt'));

  const guardResult = checkProtectedFiles(entries, 'unauthorized_user');
  assert.equal(guardResult.passed, false);
  assert.deepEqual(guardResult.modifiedProtectedFiles, ['docker-compose.yml']);
});
