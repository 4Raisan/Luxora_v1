import { PrismaClient, Prisma } from '@prisma/client';

// Money columns are stored as DECIMAL(12,2) and reach the application as
// Prisma.Decimal. All financial arithmetic stays in Decimal; only the final
// JSON serialization converts to a plain number so API responses keep their
// existing shape (numbers, not strings).
Prisma.Decimal.prototype.toJSON = function toJSON() {
  return this.toNumber();
};

// Single shared Prisma client for the whole backend.  Direct PostgreSQL URLs
// otherwise use Prisma's CPU-derived default pool, which is too aggressive for
// the small managed database used by the demo when multiple app processes are
// present.  Preserve an explicit operator setting, but keep the safe default
// to five connections per Node process (replicas must be budgeted separately).
function applySafePoolDefaults() {
  const value = process.env.DATABASE_URL;
  if (!value || !/^(postgres|postgresql):\/\//i.test(value)) return;
  try {
    const url = new URL(value);
    const configuredLimit = Number.parseInt(process.env.PRISMA_CONNECTION_LIMIT, 10);
    const configuredTimeout = Number.parseInt(process.env.PRISMA_POOL_TIMEOUT, 10);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', String(Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 5));
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', String(Number.isInteger(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 10));
    process.env.DATABASE_URL = url.toString();
  } catch {
    // Leave an operator-provided URL untouched; Prisma will report malformed
    // connection strings during startup rather than silently changing them.
  }
}

applySafePoolDefaults();
export const prisma = new PrismaClient();
