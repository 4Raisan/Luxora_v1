-- Add immutable snapshot fields to user_subscriptions
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "planTitle" TEXT;
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "planType" TEXT;
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "pricePaid" DECIMAL(12,2);
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER NOT NULL DEFAULT 30;

-- Create user_subscription_entitlements table for purchased entitlement snapshots
CREATE TABLE IF NOT EXISTS "user_subscription_entitlements" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_subscription_entitlements_pkey" PRIMARY KEY ("id")
);

-- Indices and constraints for user_subscription_entitlements
CREATE UNIQUE INDEX IF NOT EXISTS "user_subscription_entitlements_subscriptionId_categoryId_key" ON "user_subscription_entitlements"("subscriptionId", "categoryId");
CREATE INDEX IF NOT EXISTS "user_subscription_entitlements_categoryId_idx" ON "user_subscription_entitlements"("categoryId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscription_entitlements_subscriptionId_fkey') THEN
        ALTER TABLE "user_subscription_entitlements" ADD CONSTRAINT "user_subscription_entitlements_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscription_entitlements_categoryId_fkey') THEN
        ALTER TABLE "user_subscription_entitlements" ADD CONSTRAINT "user_subscription_entitlements_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill existing user_subscriptions with plan snapshots
UPDATE "user_subscriptions" us
SET "planTitle" = sp."title",
    "planType" = sp."type",
    "pricePaid" = sp."priceMonthly",
    "durationDays" = sp."durationDays",
    "currency" = 'LKR'
FROM "subscription_plans" sp
WHERE us."planId" = sp."id" AND (us."planTitle" IS NULL OR us."pricePaid" IS NULL);

-- Backfill existing active user_subscription entitlements
INSERT INTO "user_subscription_entitlements" ("subscriptionId", "categoryId", "units")
SELECT us."id", se."categoryId", se."units"
FROM "user_subscriptions" us
JOIN "subscription_entitlements" se ON us."planId" = se."planId"
ON CONFLICT ("subscriptionId", "categoryId") DO NOTHING;

-- Add banking columns
ALTER TABLE "provider_bank_accounts" ADD COLUMN IF NOT EXISTS "accountMask" TEXT;
ALTER TABLE "provider_bank_accounts" ADD COLUMN IF NOT EXISTS "accountHash" TEXT;

-- Normalize provider bank accounts before creating unique index:
-- 1. If multiple accounts are selected for a provider, keep only the latest updated one selected
WITH RankedSelected AS (
    SELECT id, "providerId",
           ROW_NUMBER() OVER (PARTITION BY "providerId" ORDER BY "updatedAt" DESC, id DESC) as rn
    FROM "provider_bank_accounts"
    WHERE "selected" = true
)
UPDATE "provider_bank_accounts"
SET "selected" = false
WHERE id IN (
    SELECT id FROM RankedSelected WHERE rn > 1
);

-- 2. If a provider has accounts but none selected, select the latest updated one
WITH ProviderSelections AS (
    SELECT "providerId", COUNT(*) FILTER (WHERE "selected" = true) as sel_count
    FROM "provider_bank_accounts"
    GROUP BY "providerId"
),
RankedAccounts AS (
    SELECT pba.id,
           ROW_NUMBER() OVER (PARTITION BY pba."providerId" ORDER BY pba."updatedAt" DESC, pba.id DESC) as rn
    FROM "provider_bank_accounts" pba
    JOIN ProviderSelections ps ON pba."providerId" = ps."providerId"
    WHERE ps.sel_count = 0
)
UPDATE "provider_bank_accounts"
SET "selected" = true
WHERE id IN (
    SELECT id FROM RankedAccounts WHERE rn = 1
);

-- Create partial unique index ensuring at most one selected bank account per provider
CREATE UNIQUE INDEX IF NOT EXISTS "unique_provider_selected_bank_account" ON "provider_bank_accounts" ("providerId") WHERE ("selected" = true);
