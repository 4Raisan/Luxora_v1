-- AlterTable
ALTER TABLE "bookings"
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "rescheduleReason" TEXT,
ADD COLUMN "subscriptionId" INTEGER;

-- CreateIndex
CREATE INDEX "bookings_subscriptionId_idx" ON "bookings"("subscriptionId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
