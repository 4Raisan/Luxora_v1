-- V1 business-rule hardening: provider auto-assignment cooldown 6 -> 5 hours.
-- Alters the column default for new platform-setting rows and migrates rows
-- still carrying the old default. Rows an admin deliberately customized to a
-- value other than 6 are left untouched.
ALTER TABLE "platform_settings" ALTER COLUMN "autoAssignmentCooldownHours" SET DEFAULT 5;
UPDATE "platform_settings" SET "autoAssignmentCooldownHours" = 5 WHERE "autoAssignmentCooldownHours" = 6;
