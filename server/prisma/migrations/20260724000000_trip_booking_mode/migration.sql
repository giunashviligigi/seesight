-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('FLIGHTS', 'HOTELS', 'BOTH');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "bookingMode" "BookingMode" NOT NULL DEFAULT 'BOTH';
