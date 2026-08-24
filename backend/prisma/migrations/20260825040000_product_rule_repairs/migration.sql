ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "addressStreet" TEXT,
  ADD COLUMN IF NOT EXISTS "addressDistrict" TEXT;
ALTER TABLE "users" DROP COLUMN IF EXISTS "isSuperAdmin";

ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "providerEarning" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "addressStreet" TEXT,
  ADD COLUMN IF NOT EXISTS "addressDistrict" TEXT,
  ADD COLUMN IF NOT EXISTS "providerEarning" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "provider_bank_accounts" (
  "id" SERIAL PRIMARY KEY,
  "providerId" INTEGER NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "bankName" TEXT NOT NULL,
  "accountHolder" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "provider_bank_accounts_providerId_selected_idx" ON "provider_bank_accounts"("providerId", "selected");

CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
CREATE TABLE IF NOT EXISTS "provider_payouts" (
  "id" SERIAL PRIMARY KEY,
  "providerId" INTEGER NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "bankAccountId" INTEGER NOT NULL REFERENCES "provider_bank_accounts"("id") ON DELETE RESTRICT,
  "period" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_payouts_providerId_period_key" UNIQUE ("providerId", "period")
);
CREATE INDEX IF NOT EXISTS "provider_payouts_period_status_idx" ON "provider_payouts"("period", "status");

-- No PayPal records exist in the deployed database. Rebuild the enum without
-- the obsolete value while retaining existing PayHere and demo payment rows.
CREATE TYPE "PaymentGateway_new" AS ENUM ('PAYHERE', 'DEMO');
ALTER TABLE "payments" ALTER COLUMN "gateway" TYPE "PaymentGateway_new" USING "gateway"::text::"PaymentGateway_new";
DROP TYPE "PaymentGateway";
ALTER TYPE "PaymentGateway_new" RENAME TO "PaymentGateway";
