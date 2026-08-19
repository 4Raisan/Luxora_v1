ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "isSuperAdmin" = true WHERE "email" = 'admin@luxora.lk';
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "renewalIntervalDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "nextRenewalDate" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customerStartPinCipher" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customerCompletionPinCipher" TEXT;

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "autoAssignmentCooldownHours" INTEGER NOT NULL DEFAULT 6,
  "autoAssignmentStartHour" INTEGER NOT NULL DEFAULT 7,
  "autoAssignmentEndHour" INTEGER NOT NULL DEFAULT 16,
  "paymentMode" TEXT NOT NULL DEFAULT 'payhere',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "platform_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'DEMO';
