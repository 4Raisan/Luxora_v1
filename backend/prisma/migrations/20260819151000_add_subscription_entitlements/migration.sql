-- CreateTable
CREATE TABLE "subscription_entitlements" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subscription_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_entitlements_planId_categoryId_key" ON "subscription_entitlements"("planId", "categoryId");

-- CreateIndex
CREATE INDEX "subscription_entitlements_categoryId_idx" ON "subscription_entitlements"("categoryId");

-- AddForeignKey
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the plans created by the existing seed. Unknown or future plans remain at zero until an entitlement is configured.
INSERT INTO "subscription_entitlements" ("planId", "categoryId", "units")
SELECT p."id", c."id",
  CASE
    WHEN lower(p."title") LIKE '%tri-combo%' AND c."name" = 'Auto Care' THEN 2
    WHEN lower(p."title") LIKE '%tri-combo%' AND c."name" = 'Garden Care' THEN 4
    WHEN lower(p."title") LIKE '%tri-combo%' AND c."name" = 'Pet Care' THEN 2
    WHEN lower(p."title") LIKE '%auto%' AND c."name" = 'Auto Care' THEN 2
    WHEN lower(p."title") LIKE '%garden%' AND c."name" = 'Garden Care' THEN 4
    WHEN lower(p."title") LIKE '%pet%' AND c."name" = 'Pet Care' THEN 2
    ELSE 0
  END
FROM "subscription_plans" p
CROSS JOIN "categories" c
WHERE lower(p."title") LIKE '%auto%'
   OR lower(p."title") LIKE '%garden%'
   OR lower(p."title") LIKE '%pet%'
   OR lower(p."title") LIKE '%tri-combo%'
ON CONFLICT ("planId", "categoryId") DO NOTHING;
