CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED');

-- CreateTable
-- CreateTable
CREATE TABLE "refund_requests" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "requestedBy" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(500),
    "adminNote" VARCHAR(1000),
    "providerRef" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_providerRef_key" ON "refund_requests"("providerRef");
CREATE INDEX "refund_requests_paymentId_idx" ON "refund_requests"("paymentId");
CREATE INDEX "refund_requests_status_idx" ON "refund_requests"("status");
CREATE INDEX "refund_requests_requestedBy_idx" ON "refund_requests"("requestedBy");

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open refund per payment (partial unique index; Prisma cannot express the WHERE clause)
CREATE UNIQUE INDEX "refund_requests_one_open_per_payment" ON "refund_requests"("paymentId") WHERE "status" IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING');
