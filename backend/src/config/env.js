import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

// Central place for env config. In production the secrets must come from the
// environment; in development we fall back to an ephemeral secret so the
// server still boots (tokens simply invalidate on restart).
export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';

function resolveJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start in production.');
    process.exit(1);
  }
  const ephemeral = crypto.randomBytes(48).toString('hex');
  console.warn('WARNING: JWT_SECRET is not set. Using an ephemeral dev secret (tokens reset on restart).');
  return ephemeral;
}

export const JWT_SECRET = resolveJwtSecret();

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Point it at your PostgreSQL / Neon database in .env');
}
