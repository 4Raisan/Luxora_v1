CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED');

CREATE TABLE "refund_requests" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "subscriptionId" INTEGER NOT NULL,
  "paymentId" INTEGER,
  "reason" TEXT,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "adminNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" INTEGER,
  CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refund_requests_subscriptionId_key" ON "refund_requests"("subscriptionId");
CREATE INDEX "refund_requests_userId_status_idx" ON "refund_requests"("userId", "status");
CREATE INDEX "refund_requests_status_requestedAt_idx" ON "refund_requests"("status", "requestedAt");
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
