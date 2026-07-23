-- CreateEnum
CREATE TYPE "BookingNeeds" AS ENUM ('BOTH', 'FLIGHT_ONLY', 'HOTEL_ONLY');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "bookingNeeds" "BookingNeeds" NOT NULL DEFAULT 'BOTH';
