import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

// Resolve direct connection for Prisma migrations:
// In Neon / PgBouncer deployments, DATABASE_URL uses the transaction pooler
// (e.g. ep-falling-wind-azr0lzts-pooler...neon.tech).
// PgBouncer in transaction mode does not support PostgreSQL session-level
// advisory locks (SELECT pg_advisory_lock), causing Prisma P1002 timeouts (10000ms).
// Prisma migrations must connect to the direct unpooled compute instance.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  if (process.env.DATABASE_URL.includes('-pooler')) {
    process.env.DIRECT_URL = process.env.DATABASE_URL.replace('-pooler', '');
    console.log('[migrations] Derived DIRECT_URL from DATABASE_URL (stripped Neon pooler host).');
  } else {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

console.log('[migrations] Running Prisma migrations against direct database connection...');
try {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
  console.log('[migrations] Migrations applied successfully.');
} catch (error) {
  console.error('[migrations] Fatal: Migration deployment failed:', error.message);
  process.exit(1);
}
