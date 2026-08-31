-- Apply a promotion to selected subscription packages. An empty assignment
-- means the campaign is available to every active package.
CREATE TABLE "promotion_plans" (
    "promotionId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    CONSTRAINT "promotion_plans_pkey" PRIMARY KEY ("promotionId", "planId")
);

CREATE INDEX "promotion_plans_planId_idx" ON "promotion_plans"("planId");

ALTER TABLE "promotion_plans"
  ADD CONSTRAINT "promotion_plans_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_plans"
  ADD CONSTRAINT "promotion_plans_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments" ADD COLUMN "promotionId" INTEGER;
ALTER TABLE "payments" ADD COLUMN "originalAmount" DECIMAL(12,2);
ALTER TABLE "payments" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
CREATE INDEX "payments_promotionId_idx" ON "payments"("promotionId");
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
