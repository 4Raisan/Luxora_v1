import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the whole backend.  Direct PostgreSQL URLs
// otherwise use Prisma's CPU-derived default pool, which is too aggressive for
// the small managed database used by the demo when multiple app processes are
// present.  Preserve an explicit operator setting, but keep the safe default
// to one connection per Node process (replicas must be budgeted separately).
function applySafePoolDefaults() {
  const value = process.env.DATABASE_URL;
  if (!value || !/^(postgres|postgresql):\/\//i.test(value)) return;
  try {
    const url = new URL(value);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '10');
    process.env.DATABASE_URL = url.toString();
  } catch {
    // Leave an operator-provided URL untouched; Prisma will report malformed
    // connection strings during startup rather than silently changing them.
  }
}

applySafePoolDefaults();
export const prisma = new PrismaClient();
