-- Money fields move from double precision (binary float) to exact DECIMAL(12,2).
-- PostgreSQL casts existing float values to numeric implicitly, so stored data is
-- preserved. Only the six currency columns are touched; discountPct stays a float
-- because it is a percentage, not money.
ALTER TABLE "bookings" ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "payments" ALTER COLUMN "expectedAmount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "payments" ALTER COLUMN "capturedAmount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "providers" ALTER COLUMN "earnings" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "services" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "subscription_plans" ALTER COLUMN "priceMonthly" SET DATA TYPE DECIMAL(12,2);
