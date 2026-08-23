CREATE TABLE "phone_otp_challenges" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "phone_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "phone_otp_challenges_phone_key" ON "phone_otp_challenges"("phone");
CREATE INDEX "phone_otp_challenges_expiresAt_idx" ON "phone_otp_challenges"("expiresAt");
