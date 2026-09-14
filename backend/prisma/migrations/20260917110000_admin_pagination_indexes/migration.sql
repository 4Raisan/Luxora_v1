-- Additive indexes for the paginated admin listings. Each listing orders by
-- these columns with LIMIT/OFFSET and counts the same filter; without them
-- Postgres sorts the whole table per page request.
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX "bookings_createdAt_idx" ON "bookings"("createdAt");
CREATE INDEX "complaints_createdAt_idx" ON "complaints"("createdAt");
CREATE INDEX "refund_requests_requestedAt_idx" ON "refund_requests"("requestedAt");
