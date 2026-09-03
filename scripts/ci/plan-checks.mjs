import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DOCUMENT_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
]);
const PAYMENT_PATTERN = /(?:payment|payhere|nowpayments|refund|subscription|entitlement|promotion|integration)/i;
const BOOKING_PATTERN = /(?:booking|provider|assignment|scheduling|timeout|earning|payout)/i;
const SECURITY_PATTERN = /(?:auth|security|bank|upload|storage|evidence|kyc|password|token|middleware)/i;
const GLOBAL_BACKEND_PATTERN = /^backend\/src\/(?:index\.js|config\/|middleware\/rateLimit\.js)/;

function normalizePath(filePath) {
  return String(filePath || '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function isDocumentation(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.startsWith('docs/')
    || DOCUMENT_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase())
    || ['LICENSE', 'AGENTS.md'].includes(normalized);
}

function isTextDocumentation(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.startsWith('docs/')
    || ['.md', '.mdx', '.txt'].includes(path.posix.extname(normalized).toLowerCase())
    || ['LICENSE', 'AGENTS.md'].includes(normalized);
}

function isStructuralChange(status) {
  return /^(?:A|D|R|C)/.test(status);
}

function suitesForBackendTest(filePath) {
  const name = path.posix.basename(filePath);
  if (name === 'run-tests.js' || filePath.includes('/helpers/')) return ['full'];
  if (/nowpayments|payment-contract|currency|release-hardening/.test(name)) return ['payments'];
  if (/booking|new-flow|fresh-db|api-fixes/.test(name)) return ['bookings'];
  if (/security-audit/.test(name)) return ['security'];
  return ['smoke'];
}

export function classifyChanges(entries, { forceFull = false } = {}) {
  const plan = {
    quality: false,
    frontend: false,
    backend: false,
    database: false,
    docker: false,
    audit: false,
    knowledgeGraph: false,
    full: Boolean(forceFull),
    docsOnly: false,
    backendSuites: new Set(),
    reasons: [],
  };
  const changed = entries
    .map((entry) => typeof entry === 'string'
      ? { status: 'M', path: normalizePath(entry) }
      : { status: String(entry.status || 'M'), path: normalizePath(entry.path) })
    .filter((entry) => entry.path);

  if (forceFull) plan.reasons.push('Scheduled or manually requested full validation.');
  if (changed.length === 0) {
    plan.full = true;
    plan.reasons.push('No reliable changed-file list was available.');
  }

  let documentationCount = 0;
  for (const entry of changed) {
    const file = entry.path;
    if (file.startsWith('.github/workflows/')
      || file.startsWith('scripts/ci/')
      || file === '.gitleaks.toml') {
      plan.full = true;
      plan.reasons.push(file + ' changes CI or its safety rules.');
      continue;
    }
    if (file === 'Dockerfile' || file === '.dockerignore' || /^docker-compose(?:\.[^/]+)?\.ya?ml$/.test(file)) {
      plan.docker = true;
      plan.reasons.push(file + ' changes the production container path.');
      continue;
    }
    if (file === 'package.json' || file === 'package-lock.json') {
      plan.full = true;
      plan.audit = true;
      plan.reasons.push(file + ' changes shared build or dependency tooling.');
      continue;
    }
    if (file.startsWith('Knowladge-Graph/')) {
      plan.knowledgeGraph = true;
      plan.quality = true;
      plan.reasons.push(file + ' changes Knowledge Graph definition or artifacts.');
      continue;
    }
    if (isTextDocumentation(file)) {
      documentationCount += 1;
      continue;
    }
    if (file.startsWith('frontend/')) {
      plan.quality = true;
      plan.frontend = true;
      plan.knowledgeGraph = true;
      if (/^frontend\/package(?:-lock)?\.json$/.test(file)) plan.audit = true;
      plan.reasons.push(file + ' requires frontend validation.');
      continue;
    }
    if (file.startsWith('backend/')) {
      plan.quality = true;
      plan.backend = true;
      plan.knowledgeGraph = true;
      if (/^backend\/package(?:-lock)?\.json$/.test(file)) {
        plan.audit = true;
        plan.docker = true;
        plan.backendSuites.add('full');
        plan.reasons.push(file + ' changes backend production dependencies.');
        continue;
      }
      if (file.startsWith('backend/prisma/')) {
        plan.database = true;
        plan.docker = true;
        plan.backendSuites.add('full');
        plan.reasons.push(file + ' changes the production database contract.');
        continue;
      }
      if (file.startsWith('backend/tests/')) {
        if (isStructuralChange(entry.status)) {
          plan.backendSuites.add('full');
          plan.reasons.push(file + ' adds, removes, or renames backend test coverage.');
          continue;
        }
        for (const suite of suitesForBackendTest(file)) plan.backendSuites.add(suite);
        plan.reasons.push(file + ' requires its owning backend test suite.');
        continue;
      }
      if (GLOBAL_BACKEND_PATTERN.test(file)) {
        plan.docker = true;
        plan.backendSuites.add('full');
        plan.reasons.push(file + ' is a global backend runtime file.');
        continue;
      }
      if (PAYMENT_PATTERN.test(file)) {
        plan.docker = true;
        plan.backendSuites.add('payments');
        plan.backendSuites.add('security');
        plan.reasons.push(file + ' affects money or entitlement state.');
        continue;
      }
      if (BOOKING_PATTERN.test(file)) {
        plan.backendSuites.add('bookings');
        plan.reasons.push(file + ' affects booking or provider fulfilment.');
        continue;
      }
      if (SECURITY_PATTERN.test(file)) {
        plan.docker = true;
        plan.backendSuites.add('security');
        plan.backendSuites.add('smoke');
        plan.reasons.push(file + ' affects authentication or sensitive data.');
        continue;
      }
      if (file.startsWith('backend/src/') && isStructuralChange(entry.status)) {
        plan.docker = true;
        plan.backendSuites.add('full');
        plan.reasons.push(file + ' is a structural backend source change; using full coverage.');
        continue;
      }
      plan.backendSuites.add('smoke');
      plan.reasons.push(file + ' requires backend smoke coverage.');
      continue;
    }
    if (isDocumentation(file)) {
      documentationCount += 1;
      continue;
    }
    if (file.startsWith('.vscode/')
      || file.startsWith('.idea/')
      || ['.gitignore', '.editorconfig'].includes(file)) {
      documentationCount += 1;
      continue;
    }
    plan.full = true;
    plan.reasons.push(file + ' is not classified; using the safe full-CI fallback.');
  }

  const sourceChangeCount = changed.filter(({ path: file }) => !isDocumentation(file)
    && !file.startsWith('Knowladge-Graph/')
    && !file.startsWith('.vscode/')
    && !file.startsWith('.idea/')
    && !['.gitignore', '.editorconfig'].includes(file)).length;
  if (sourceChangeCount > 30) {
    plan.full = true;
    plan.reasons.push('Large source change set detected (' + sourceChangeCount + ' files).');
  }
  if (plan.full) {
    plan.quality = true;
    plan.frontend = true;
    plan.backend = true;
    plan.database = true;
    plan.docker = true;
    plan.audit = true;
    plan.knowledgeGraph = true;
    plan.backendSuites.clear();
    plan.backendSuites.add('full');
  }
  if (plan.backendSuites.has('full')) {
    plan.backendSuites.clear();
    plan.backendSuites.add('full');
  }
  if (plan.backend && plan.backendSuites.size === 0) plan.backendSuites.add('smoke');
  plan.docsOnly = changed.length > 0
    && documentationCount === changed.length
    && !plan.full
    && !plan.frontend
    && !plan.backend
    && !plan.docker;

  return {
    ...plan,
    backendSuites: [...plan.backendSuites],
    changedFiles: changed,
  };
}

function parseNameStatus(raw) {
  return raw.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    const parts = line.split('\t');
    const status = parts[0] || 'M';
    if (status.startsWith('R') || status.startsWith('C')) {
      return [
        { status: status + '-old', path: normalizePath(parts[1]) },
        { status: status + '-new', path: normalizePath(parts[2]) },
      ];
    }
    return [{ status, path: normalizePath(parts[1]) }];
  });
}

function hasCommit(commit) {
  if (!commit || /^0+$/.test(commit)) return false;
  try {
    execFileSync('git', ['cat-file', '-e', commit + '^{commit}'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function writeGithubOutput(plan) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  const values = {
    quality: plan.quality,
    frontend: plan.frontend,
    backend: plan.backend,
    database: plan.database,
    docker: plan.docker,
    audit: plan.audit,
    knowledge_graph: plan.knowledgeGraph,
    full: plan.full,
    docs_only: plan.docsOnly,
    backend_suites: plan.backendSuites.join(',') || 'smoke',
  };
  const lines = Object.entries(values).map(([key, value]) => key + '=' + String(value));
  fs.appendFileSync(outputFile, lines.join('\n') + '\n');
}

function writeSummary(plan) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  const checks = [
    ['Quality/lint', plan.quality],
    ['Frontend build', plan.frontend],
    ['Backend (' + (plan.backendSuites.join(', ') || 'none') + ')', plan.backend],
    ['Database coverage', plan.database],
    ['Docker smoke', plan.docker],
    ['Dependency audit', plan.audit],
    ['Knowledge Graph workflow', plan.knowledgeGraph],
    ['Full fallback', plan.full],
  ];
  const body = [
    '## Selective CI plan',
    '',
    ...checks.map(([name, enabled]) => '- ' + (enabled ? '✅' : '➖') + ' ' + name),
    '',
    'Changed files: ' + plan.changedFiles.length,
    '',
    ...plan.reasons.map((reason) => '- ' + reason),
    '',
  ].join('\n');
  fs.appendFileSync(summaryFile, body);
}

function main() {
  const args = process.argv.slice(2);
  const readArg = (name) => {
    const exact = args.find((value) => value.startsWith(name + '='));
    if (exact) return exact.slice(name.length + 1);
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const base = readArg('--base');
  const head = readArg('--head') || 'HEAD';
  const forceFull = args.includes('--force-full') || process.env.FORCE_FULL === 'true';
  let entries = [];
  let reliableDiff = hasCommit(base) && hasCommit(head);
  if (reliableDiff) {
    try {
      const output = execFileSync(
        'git',
        ['diff', '--name-status', '--find-renames', base + '...' + head],
        { encoding: 'utf8' },
      );
      entries = parseNameStatus(output);
    } catch {
      reliableDiff = false;
    }
  }
  const plan = classifyChanges(entries, { forceFull: forceFull || !reliableDiff });
  if (!reliableDiff) plan.reasons.unshift('Git comparison base was unavailable; selected full CI.');
  writeGithubOutput(plan);
  writeSummary(plan);
  process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
}

if (path.resolve(process.argv[1] || '') === path.resolve(SCRIPT_PATH)) main();
