ALTER TABLE "provider_bank_accounts"
  ADD COLUMN IF NOT EXISTS "branch" TEXT NOT NULL DEFAULT '';

ALTER TABLE "provider_payouts"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "bankNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "accountHolderSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "accountNumberSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "branchSnapshot" TEXT;

CREATE INDEX IF NOT EXISTS "provider_payouts_kind_status_createdAt_idx"
  ON "provider_payouts"("kind", "status", "createdAt");
