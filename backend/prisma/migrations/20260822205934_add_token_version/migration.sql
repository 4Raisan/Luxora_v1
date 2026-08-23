-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "complaints" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "platform_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;
