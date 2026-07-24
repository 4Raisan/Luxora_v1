import dotenv from 'dotenv';

dotenv.config();

// Central place for env config. No secret fallbacks are hardcoded —
// DATABASE_URL and JWT_SECRET must come from the .env file.
export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Auth will fail until you add it to .env');
}
if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Point it at your PostgreSQL / Aiven database in .env');
}
