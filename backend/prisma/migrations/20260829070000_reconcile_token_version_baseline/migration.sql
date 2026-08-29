-- The Neon schema was initially created with `prisma db push` and therefore
-- has no migration history. Schema verification found every current object
-- except this additive JWT-revocation column. This migration is deliberately
-- idempotent so the verified legacy schema can be safely baselined, then
-- brought to the final Prisma contract by `prisma migrate deploy`.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
