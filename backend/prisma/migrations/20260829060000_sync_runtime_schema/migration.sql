-- Bring migration-built databases in line with schema.prisma. Earlier
-- deployments relied on non-awaited startup DDL and db push, which left a
-- fresh `prisma migrate deploy` database without several runtime objects.

ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'NOWPAYMENTS';

ALTER TABLE "promotions"
  ALTER COLUMN "discountPct" SET DATA TYPE DECIMAL(5,2);

ALTER TABLE "providers"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "provider_bank_accounts"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Phone OTP/WhatsApp verification was removed from the confirmed product.
DROP TABLE IF EXISTS "phone_otp_challenges";

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" SERIAL NOT NULL,
  "adminId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "details" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

ALTER TABLE "provider_bank_accounts" DROP CONSTRAINT IF EXISTS "provider_bank_accounts_providerId_fkey";
ALTER TABLE "provider_bank_accounts" ADD CONSTRAINT "provider_bank_accounts_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_payouts" DROP CONSTRAINT IF EXISTS "provider_payouts_providerId_fkey";
ALTER TABLE "provider_payouts" ADD CONSTRAINT "provider_payouts_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_payouts" DROP CONSTRAINT IF EXISTS "provider_payouts_bankAccountId_fkey";
ALTER TABLE "provider_payouts" ADD CONSTRAINT "provider_payouts_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "provider_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_adminId_fkey'
  ) THEN
    ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
