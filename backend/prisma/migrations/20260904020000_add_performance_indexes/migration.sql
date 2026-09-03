-- DropIndex
DROP INDEX IF EXISTS "notifications_userId_idx";

-- CreateIndex
CREATE INDEX "user_subscriptions_userId_status_endDate_idx" ON "user_subscriptions"("userId", "status", "endDate");

-- CreateIndex
CREATE INDEX "bookings_userId_subscriptionId_status_idx" ON "bookings"("userId", "subscriptionId", "status");

-- CreateIndex
CREATE INDEX "payments_userId_createdAt_idx" ON "payments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");

-- CreateIndex
CREATE INDEX "complaints_userId_idx" ON "complaints"("userId");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");
