import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export const AUTHORIZED_MAINTAINER = '4Raisan';

export const PROTECTED_PATTERNS = [
  '.github/workflows/**',
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
  '.github/dependabot.yaml',
  '.gitleaks.toml',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'vercel.json',
];

export function normalizePath(filePath) {
  return String(filePath || '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isProtectedPath(filePath) {
  const normalized = normalizePath(filePath);
  const lower = normalized.toLowerCase();

  if (lower.startsWith('.github/workflows/')) return true;
  if (lower === '.github/codeowners') return true;
  if (lower === '.github/dependabot.yml' || lower === '.github/dependabot.yaml') return true;
  if (lower === '.gitleaks.toml') return true;
  if (lower === 'dockerfile') return true;
  if (lower === 'docker-compose.yml' || lower === 'docker-compose.yaml') return true;
  if (lower === 'vercel.json') return true;

  return false;
}

export function checkProtectedFiles(entries, actor) {
  const changedPaths = new Set();

  for (const entry of entries) {
    if (typeof entry === 'string') {
      const normalized = normalizePath(entry);
      if (normalized) changedPaths.add(normalized);
    } else if (entry && entry.path) {
      const normalized = normalizePath(entry.path);
      if (normalized) changedPaths.add(normalized);
      if (entry.oldPath) {
        const normalizedOld = normalizePath(entry.oldPath);
        if (normalizedOld) changedPaths.add(normalizedOld);
      }
    }
  }

  const modifiedProtectedFiles = [...changedPaths].filter((p) => isProtectedPath(p)).sort();
  const normalizedActor = String(actor || '').trim();
  const isMaintainer = normalizedActor.toLowerCase() === AUTHORIZED_MAINTAINER.toLowerCase();

  if (modifiedProtectedFiles.length === 0) {
    return {
      passed: true,
      actor: normalizedActor,
      isMaintainer,
      modifiedProtectedFiles: [],
      reason: 'No protected files were modified.',
    };
  }

  if (isMaintainer) {
    return {
      passed: true,
      actor: normalizedActor,
      isMaintainer: true,
      modifiedProtectedFiles,
      reason: `Protected files modified by authorized maintainer @${AUTHORIZED_MAINTAINER}.`,
    };
  }

  return {
    passed: false,
    actor: normalizedActor || 'unknown',
    isMaintainer: false,
    modifiedProtectedFiles,
    reason: `Unauthorized attempt to modify protected files by user '${normalizedActor || 'unknown'}'. Only @${AUTHORIZED_MAINTAINER} is authorized to modify repository configuration, CI workflows, and deployment files.`,
  };
}

export function parseNameStatus(raw) {
  return raw.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    const parts = line.split('\t');
    const status = parts[0] || 'M';
    if (status.startsWith('R') || status.startsWith('C')) {
      return [
        { status: status + '-old', path: normalizePath(parts[1]) },
        { status: status + '-new', path: normalizePath(parts[2]), oldPath: normalizePath(parts[1]) },
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

export function collectChangedFilesFromGit(base, head) {
  const entries = [];
  if (hasCommit(base) && hasCommit(head)) {
    try {
      const output = execFileSync(
        'git',
        ['diff', '--name-status', '--find-renames', base, head],
        { encoding: 'utf8' },
      );
      entries.push(...parseNameStatus(output));
      return entries;
    } catch {
      // Fall through to fallback methods
    }
  }

  // If base is not available or diff failed, check single commit or HEAD parent
  try {
    const output = execFileSync(
      'git',
      ['diff-tree', '--no-commit-id', '--name-status', '-r', '--find-renames', head || 'HEAD'],
      { encoding: 'utf8' },
    );
    entries.push(...parseNameStatus(output));
  } catch {
    // If diff-tree fails, check unstaged/staged git status
    try {
      const output = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
      for (const line of output.split(/\r?\n/)) {
        if (!line) continue;
        const filePath = line.slice(3).trim();
        if (filePath) entries.push({ status: 'M', path: normalizePath(filePath) });
      }
    } catch {
      // Ignore if not a git repository
    }
  }

  return entries;
}

export function collectChangedFilesFromEvent(eventPayload) {
  const entries = [];
  if (!eventPayload || typeof eventPayload !== 'object') return entries;

  if (Array.isArray(eventPayload.commits)) {
    for (const commit of eventPayload.commits) {
      if (Array.isArray(commit.added)) {
        for (const file of commit.added) entries.push({ status: 'A', path: normalizePath(file) });
      }
      if (Array.isArray(commit.modified)) {
        for (const file of commit.modified) entries.push({ status: 'M', path: normalizePath(file) });
      }
      if (Array.isArray(commit.removed)) {
        for (const file of commit.removed) entries.push({ status: 'D', path: normalizePath(file) });
      }
    }
  }

  if (eventPayload.head_commit && typeof eventPayload.head_commit === 'object') {
    const head = eventPayload.head_commit;
    if (Array.isArray(head.added)) {
      for (const file of head.added) entries.push({ status: 'A', path: normalizePath(file) });
    }
    if (Array.isArray(head.modified)) {
      for (const file of head.modified) entries.push({ status: 'M', path: normalizePath(file) });
    }
    if (Array.isArray(head.removed)) {
      for (const file of head.removed) entries.push({ status: 'D', path: normalizePath(file) });
    }
  }

  return entries;
}

function writeSummary(result) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const lines = [
    '## 🛡️ Protected Files Guard',
    '',
    `- **Status**: ${result.passed ? '✅ Passed' : '❌ Failed'}`,
    `- **Actor**: \`${result.actor || 'unknown'}\``,
    `- **Maintainer Authorized**: ${result.isMaintainer ? 'Yes (@' + AUTHORIZED_MAINTAINER + ')' : 'No'}`,
    `- **Protected Files Count**: ${result.modifiedProtectedFiles.length}`,
    '',
  ];

  if (result.modifiedProtectedFiles.length > 0) {
    lines.push('### Modified Protected Files');
    lines.push('');
    for (const file of result.modifiedProtectedFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  if (!result.passed) {
    lines.push('> [!CAUTION]');
    lines.push(`> **Security Policy Violation**: Only **@${AUTHORIZED_MAINTAINER}** is authorized to modify CI workflows, deployment configs, and repository protection rules.`);
    lines.push('> Direct commits to application code (frontend, backend, documentation) remain open for all contributors.');
    lines.push('');
  }

  fs.appendFileSync(summaryFile, lines.join('\n') + '\n');
}

export function main() {
  const args = process.argv.slice(2);
  const readArg = (name) => {
    const exact = args.find((value) => value.startsWith(name + '='));
    if (exact) return exact.slice(name.length + 1);
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const base = readArg('--base') || process.env.BASE_SHA;
  const head = readArg('--head') || process.env.HEAD_SHA || 'HEAD';
  let actor = readArg('--actor') || process.env.GITHUB_ACTOR;

  let eventPayload = null;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      eventPayload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      if (!actor) {
        actor = eventPayload.sender?.login || eventPayload.pusher?.name;
      }
    } catch {
      // Failed to parse event file
    }
  }

  if (!actor) {
    actor = process.env.USER || process.env.USERNAME || 'unknown';
  }

  const gitEntries = collectChangedFilesFromGit(base, head);
  const eventEntries = collectChangedFilesFromEvent(eventPayload);
  const combinedEntries = [...gitEntries, ...eventEntries];

  const result = checkProtectedFiles(combinedEntries, actor);

  writeSummary(result);

  if (!result.passed) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ PROTECTED FILES GUARD FAILED');
    console.error('='.repeat(70));
    console.error(`Actor: '${result.actor}' is NOT authorized to modify protected files.`);
    console.error(`Authorized maintainer: @${AUTHORIZED_MAINTAINER}`);
    console.error('\nProtected files modified in this push:');
    for (const file of result.modifiedProtectedFiles) {
      console.error(`  - ${file}`);
      // GitHub Actions log annotation
      console.error(`::error file=${file}::Unauthorized change to protected file '${file}'. Only @${AUTHORIZED_MAINTAINER} is authorized to modify this file.`);
    }
    console.error('\nSecurity rule:');
    console.error('Direct commits to application code (frontend, backend, docs) are permitted.');
    console.error(`Changes to CI workflows, container configurations, and repo security are restricted to @${AUTHORIZED_MAINTAINER}.`);
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  if (result.modifiedProtectedFiles.length > 0) {
    console.log(`✅ Protected Files Guard: Modified ${result.modifiedProtectedFiles.length} protected file(s) by authorized maintainer @${AUTHORIZED_MAINTAINER}.`);
    for (const file of result.modifiedProtectedFiles) {
      console.log(`  - ${file}`);
    }
  } else {
    console.log('✅ Protected Files Guard: No protected files were modified. Normal source-code push verified.');
  }

  process.exit(0);
}

if (path.resolve(process.argv[1] || '') === path.resolve(SCRIPT_PATH)) {
  main();
}
