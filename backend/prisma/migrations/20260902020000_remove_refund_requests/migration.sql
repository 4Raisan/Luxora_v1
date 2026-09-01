-- DropForeignKey
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_userId_fkey";
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_subscriptionId_fkey";
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_paymentId_fkey";
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_reviewedById_fkey";

-- DropTable
DROP TABLE IF EXISTS "refund_requests";

-- DropEnum
DROP TYPE IF EXISTS "RefundStatus";
