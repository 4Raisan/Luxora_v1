ALTER TABLE "support_tickets"
ADD COLUMN "providerId" INTEGER,
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SUPPORT',
ADD COLUMN "category" TEXT,
ADD COLUMN "preferredDate" TEXT,
ADD COLUMN "preferredTime" TEXT,
ADD COLUMN "town" TEXT,
ADD COLUMN "addressDistrict" TEXT;

CREATE INDEX "support_tickets_kind_providerId_status_idx"
ON "support_tickets"("kind", "providerId", "status");

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "providers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
